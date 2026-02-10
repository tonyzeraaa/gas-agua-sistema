import { useState, useEffect } from 'react'
import { Container, Typography, Button, Paper, Stack, Box, TextField, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, List, ListItem, ListItemText, Divider, Chip, InputAdornment } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart'
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle'
import AddCircleIcon from '@mui/icons-material/AddCircle'
import SearchIcon from '@mui/icons-material/Search'
import FilterListIcon from '@mui/icons-material/FilterList' // Ícone genérico para "Todos"
import HomeIcon from '@mui/icons-material/Home'
import StoreIcon from '@mui/icons-material/Store'
import AgricultureIcon from '@mui/icons-material/Agriculture'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import { supabase } from './supabaseClient'

function Venda({ aoVoltar }) {
  // Dados do Banco
  const [clientes, setClientes] = useState([])
  const [produtos, setProdutos] = useState([])
  const [precosEspeciais, setPrecosEspeciais] = useState([])

  // Filtros
  const [termoBusca, setTermoBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('todos') // 'todos', 'cidade', 'comercio', 'sitio', 'prefeitura'

  // Carrinho
  const [clienteSelecionado, setClienteSelecionado] = useState(null)
  const [carrinho, setCarrinho] = useState({}) // { id_produto: quantidade }
  const [formaPagamento, setFormaPagamento] = useState('dinheiro')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    buscarDados()
  }, [])

  async function buscarDados() {
    const { data: cli } = await supabase.from('clientes').select('*').order('nome')
    const { data: prod } = await supabase.from('produtos').select('*').order('id')
    const { data: prec } = await supabase.from('precos_personalizados').select('*')

    if (cli) setClientes(cli)
    if (prod) setProdutos(prod)
    if (prec) setPrecosEspeciais(prec)
  }

  // --- LÓGICA DE FILTRAGEM ---
  const clientesFiltrados = clientes.filter(cliente => {
    // 1. Filtro por Texto (Nome ou Endereço)
    const textoMatch = cliente.nome.toLowerCase().includes(termoBusca.toLowerCase()) || 
                       (cliente.endereco && cliente.endereco.toLowerCase().includes(termoBusca.toLowerCase()))
    
    // 2. Filtro por Tipo (Cidade, Sítio, etc)
    const tipoMatch = filtroTipo === 'todos' ? true : cliente.tipo === filtroTipo

    return textoMatch && tipoMatch
  })

  // --- LÓGICA DO CARRINHO ---
  const abrirCarrinho = (cliente) => {
    setClienteSelecionado(cliente)
    setCarrinho({}) // Reseta carrinho
    setFormaPagamento('dinheiro')
  }

  const fecharCarrinho = () => {
    setClienteSelecionado(null)
  }

  const alterarQtd = (idProduto, delta) => {
    setCarrinho(prev => {
      const novaQtd = (prev[idProduto] || 0) + delta
      if (novaQtd <= 0) {
        const novoCarrinho = { ...prev }
        delete novoCarrinho[idProduto]
        return novoCarrinho
      }
      return { ...prev, [idProduto]: novaQtd }
    })
  }

  // Descobre o preço real (Padrao ou Especial)
  const getPreco = (produto) => {
    if (!clienteSelecionado) return produto.preco_padrao
    const especial = precosEspeciais.find(p => p.id_cliente === clienteSelecionado.id && p.id_produto === produto.id)
    return especial ? especial.preco_acordado : produto.preco_padrao
  }

  const calcularTotal = () => {
    let total = 0
    Object.entries(carrinho).forEach(([idProd, qtd]) => {
      const prod = produtos.find(p => p.id === parseInt(idProd))
      if (prod) total += qtd * getPreco(prod)
    })
    return total
  }

  const finalizarVenda = async () => {
    if (Object.keys(carrinho).length === 0) return alert('Carrinho vazio!')
    setSalvando(true)

    try {
      // 1. Salva a Venda
      const { data: venda, error: errVenda } = await supabase
        .from('vendas')
        .insert([{
          id_cliente: clienteSelecionado.id,
          forma_pagamento: formaPagamento,
          status_pagamento: formaPagamento === 'fiado' ? 'pendente' : 'pago',
          // total: calcularTotal() // Removido se não tiver coluna total no banco, se tiver pode descomentar
        }])
        .select()
        .single()

      if (errVenda) throw errVenda

      // 2. Salva os Itens e Baixa Estoque
      const itensParaSalvar = []
      
      for (const [idProd, qtd] of Object.entries(carrinho)) {
        const produto = produtos.find(p => p.id === parseInt(idProd))
        const precoPraticado = getPreco(produto)

        itensParaSalvar.push({
          id_venda: venda.id,
          id_produto: parseInt(idProd),
          quantidade: qtd,
          preco_praticado: precoPraticado
        })

        // Baixa no Estoque (Diminui estoque_atual)
        const novoEstoque = (produto.estoque_atual || 0) - qtd
        await supabase.from('produtos')
          .update({ estoque_atual: novoEstoque })
          .eq('id', parseInt(idProd))
      }

      const { error: errItens } = await supabase.from('itens_venda').insert(itensParaSalvar)
      if (errItens) throw errItens

      alert('Venda realizada com sucesso!')
      fecharCarrinho()
      buscarDados() // Atualiza estoques locais

    } catch (error) {
      console.error('Erro detalhado:', error)
      alert('Erro ao finalizar venda. Verifique o console.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Container maxWidth="sm" style={{ marginTop: '1rem', paddingBottom: '50px' }}>
      
      <Box display="flex" alignItems="center" marginBottom={2}>
        <IconButton onClick={aoVoltar} style={{ marginRight: 10 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" style={{ fontWeight: 'bold' }}>Nova Venda</Typography>
      </Box>

      {/* ÁREA DE PESQUISA E FILTROS */}
      <Paper elevation={0} style={{ padding: '10px', backgroundColor: '#f5f5f5', marginBottom: '1rem', borderRadius: '10px' }}>
        
        {/* Campo de Texto */}
        <TextField 
          fullWidth 
          variant="outlined" 
          placeholder="Buscar Cliente..." 
          value={termoBusca}
          onChange={(e) => setTermoBusca(e.target.value)}
          size="small"
          InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon color="action" /></InputAdornment>) }}
          style={{ backgroundColor: '#fff', marginBottom: '10px' }}
        />

        {/* Botões de Filtro (Chips) */}
        <Stack direction="row" spacing={1} style={{ overflowX: 'auto', paddingBottom: '5px' }}>
          <Chip 
            icon={<FilterListIcon />}
            label="Todos" 
            onClick={() => setFiltroTipo('todos')} 
            color={filtroTipo === 'todos' ? 'primary' : 'default'} 
            variant={filtroTipo === 'todos' ? 'filled' : 'outlined'}
            clickable
          />
          <Chip 
            icon={<HomeIcon />} label="Cidade" 
            onClick={() => setFiltroTipo('cidade')} 
            color={filtroTipo === 'cidade' ? 'primary' : 'default'}
            variant={filtroTipo === 'cidade' ? 'filled' : 'outlined'}
            clickable
          />
          <Chip 
            icon={<StoreIcon />} label="Comércio" 
            onClick={() => setFiltroTipo('comercio')} 
            color={filtroTipo === 'comercio' ? 'primary' : 'default'}
            variant={filtroTipo === 'comercio' ? 'filled' : 'outlined'}
            clickable
          />
          <Chip 
            icon={<AgricultureIcon />} label="Sítio" 
            onClick={() => setFiltroTipo('sitio')} 
            color={filtroTipo === 'sitio' ? 'primary' : 'default'}
            variant={filtroTipo === 'sitio' ? 'filled' : 'outlined'}
            clickable
          />
          <Chip 
            icon={<AccountBalanceIcon />} label="Prefeitura" 
            onClick={() => setFiltroTipo('prefeitura')} 
            color={filtroTipo === 'prefeitura' ? 'primary' : 'default'}
            variant={filtroTipo === 'prefeitura' ? 'filled' : 'outlined'}
            clickable
          />
        </Stack>
      </Paper>

      <Typography variant="subtitle2" gutterBottom color="textSecondary">
        Selecione o cliente para iniciar o pedido:
      </Typography>

      {/* LISTA DE CLIENTES */}
      <List component={Paper}>
        {clientesFiltrados.length === 0 ? (
            <Box p={2} textAlign="center"><Typography color="textSecondary">Nenhum cliente encontrado.</Typography></Box>
        ) : (
            clientesFiltrados.map(cliente => (
            <div key={cliente.id}>
                <ListItem button onClick={() => abrirCarrinho(cliente)}>
                <ListItemText 
                    primary={
                        <Box display="flex" justifyContent="space-between">
                            <Typography variant="body1" fontWeight="bold">{cliente.nome}</Typography>
                            <Typography variant="caption" style={{ backgroundColor: '#eee', padding: '2px 6px', borderRadius: 4, color: '#000' }}>
                                {cliente.tipo.toUpperCase()}
                            </Typography>
                        </Box>
                    } 
                    secondary={cliente.endereco || 'Sem endereço'} 
                />
                <AddShoppingCartIcon color="primary" />
                </ListItem>
                <Divider />
            </div>
            ))
        )}
      </List>

      {/* === MODAL CARRINHO === */}
      <Dialog open={!!clienteSelecionado} onClose={fecharCarrinho} fullWidth maxWidth="sm">
        <DialogTitle style={{ backgroundColor: '#1976d2', color: 'white' }}>
          Pedido: {clienteSelecionado?.nome}
        </DialogTitle>
        <DialogContent style={{ paddingTop: '20px' }}>
          
          {/* LISTA DE PRODUTOS PARA ADICIONAR */}
          <Stack spacing={2}>
            {produtos.map(prod => {
              const qtd = carrinho[prod.id] || 0
              const preco = getPreco(prod) // Preço inteligente (Tabela ou Especial)
              const isEspecial = preco !== prod.preco_padrao

              return (
                <Paper key={prod.id} variant="outlined" style={{ padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="body1" style={{ fontWeight: 'bold' }}>{prod.nome}</Typography>
                    <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="body2" color="textSecondary">
                        R$ {preco.toFixed(2)}
                        </Typography>
                        {isEspecial && <Chip label="Preço Especial" color="success" size="small" style={{ height: 20, fontSize: '0.6rem' }} />}
                    </Box>
                  </Box>
                  
                  <Box display="flex" alignItems="center" gap={1}>
                    <IconButton color="error" onClick={() => alterarQtd(prod.id, -1)} disabled={qtd === 0}>
                      <RemoveCircleIcon />
                    </IconButton>
                    <Typography variant="h6" style={{ width: '30px', textAlign: 'center' }}>{qtd}</Typography>
                    <IconButton color="primary" onClick={() => alterarQtd(prod.id, 1)}>
                      <AddCircleIcon />
                    </IconButton>
                  </Box>
                </Paper>
              )
            })}
          </Stack>

          <Box mt={3} pt={2} borderTop="1px solid #eee">
            <Typography variant="h5" align="right" gutterBottom>
              Total: <strong>R$ {calcularTotal().toFixed(2)}</strong>
            </Typography>
            
            <TextField
              select
              label="Forma de Pagamento"
              fullWidth
              value={formaPagamento}
              onChange={(e) => setFormaPagamento(e.target.value)}
              SelectProps={{ native: true }}
              style={{ marginTop: '10px' }}
            >
              <option value="dinheiro">Dinheiro</option>
              <option value="pix">Pix</option>
              <option value="cartao">Cartão</option>
              <option value="fiado">Fiado (Pendura)</option>
            </TextField>
          </Box>

        </DialogContent>
        <DialogActions style={{ padding: '15px' }}>
          <Button onClick={fecharCarrinho} color="inherit">Cancelar</Button>
          <Button 
            onClick={finalizarVenda} 
            variant="contained" 
            size="large" 
            fullWidth
            disabled={salvando}
          >
            {salvando ? 'Processando...' : 'Confirmar Venda'}
          </Button>
        </DialogActions>
      </Dialog>

    </Container>
  )
}

export default Venda