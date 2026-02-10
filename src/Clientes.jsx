import { useState, useEffect } from 'react'
import { Container, Typography, Button, Paper, Stack, Box, Chip, CircularProgress, TextField, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Fab, InputAdornment, Tooltip, Tabs, Tab, MenuItem } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
import MoneyOffIcon from '@mui/icons-material/MoneyOff'
import SearchIcon from '@mui/icons-material/Search'
import AddIcon from '@mui/icons-material/Add'
import FilterListIcon from '@mui/icons-material/FilterList'
import HomeIcon from '@mui/icons-material/Home'
import StoreIcon from '@mui/icons-material/Store'
import AgricultureIcon from '@mui/icons-material/Agriculture'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import VisibilityIcon from '@mui/icons-material/Visibility'
import NoteAddIcon from '@mui/icons-material/NoteAdd'
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation' // Ícone Produto
import { supabase } from './supabaseClient'

function Clientes({ aoVoltar, aoClicarCliente }) {
  const [clientes, setClientes] = useState([])
  const [produtos, setProdutos] = useState([])
  const [listaPrecos, setListaPrecos] = useState([])
  const [carregando, setCarregando] = useState(true)
  
  const [termoBusca, setTermoBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [filtroTipo, setFiltroTipo] = useState('todos')

  // --- MODAIS ---
  const [modalPagamento, setModalPagamento] = useState(null)
  const [modalDivida, setModalDivida] = useState(null)
  const [valorInput, setValorInput] = useState('')
  const [observacaoInput, setObservacaoInput] = useState('')
  
  // Novo: Controle da aba de dívida (Dinheiro vs Produto)
  const [abaDivida, setAbaDivida] = useState(0) // 0 = Dinheiro, 1 = Produto
  const [produtoDividaId, setProdutoDividaId] = useState('')
  const [qtdDivida, setQtdDivida] = useState(1)

  const [salvando, setSalvando] = useState(false)
  const [modalNovoCliente, setModalNovoCliente] = useState(false)
  const [novoCliente, setNovoCliente] = useState({ nome: '', telefone: '', endereco: '', tipo: 'cidade' })
  const [precosEspeciaisInput, setPrecosEspeciaisInput] = useState({}) 

  useEffect(() => {
    buscarDadosFinanceiros()
  }, [])

  async function buscarDadosFinanceiros() {
    setCarregando(true)
    const { data: listaClientes } = await supabase.from('clientes').select('*').order('nome')
    const { data: listaProdutos } = await supabase.from('produtos').select('*').order('id')
    const { data: precos } = await supabase.from('precos_personalizados').select('*')
    
    if (listaProdutos) setProdutos(listaProdutos)
    if (precos) setListaPrecos(precos)

    const { data: vendasPendentes } = await supabase
      .from('vendas')
      .select(`id, id_cliente, status_pagamento, itens_venda ( id_produto, quantidade )`)
      .eq('status_pagamento', 'pendente')

    const clientesCalculados = listaClientes.map(cliente => {
      const vendasDoCliente = vendasPendentes.filter(v => v.id_cliente === cliente.id)
      let dividaProdutos = 0
      let itensDevidos = []

      vendasDoCliente.forEach(venda => {
        venda.itens_venda.forEach(item => {
          const produto = listaProdutos.find(p => p.id === item.id_produto)
          if (produto) {
            const precoEspecial = precos.find(p => p.id_cliente === cliente.id && p.id_produto === produto.id)
            const precoVigente = precoEspecial ? precoEspecial.preco_acordado : produto.preco_padrao
            
            const subtotalItem = item.quantidade * precoVigente
            dividaProdutos += subtotalItem
            
            itensDevidos.push(`${item.quantidade}x ${produto.nome} (R$ ${subtotalItem.toFixed(2)})`)
          }
        })
      })

      const dividaManual = cliente.saldo_devedor_inicial || 0
      if (dividaManual > 0) {
          itensDevidos.push(`Saldo Anterior: R$ ${dividaManual.toFixed(2)}`)
      }

      const dividaFinal = (dividaProdutos + dividaManual) - (cliente.saldo_credito || 0)

      return { ...cliente, divida: dividaFinal, itensResumo: itensDevidos }
    })

    setClientes(clientesCalculados)
    setCarregando(false)
  }

  const clientesFiltrados = clientes.filter(cliente => {
    const textoMatch = cliente.nome.toLowerCase().includes(termoBusca.toLowerCase()) || 
                       (cliente.endereco && cliente.endereco.toLowerCase().includes(termoBusca.toLowerCase()))
    const statusMatch = filtroStatus === 'todos' ? true : cliente.divida > 0.01
    const tipoMatch = filtroTipo === 'todos' ? true : cliente.tipo === filtroTipo
    return textoMatch && statusMatch && tipoMatch
  })

  // --- AÇÕES ---
  
  const realizarPagamento = async () => {
    if (!valorInput || parseFloat(valorInput) <= 0) return alert('Digite um valor!')
    setSalvando(true)
    try {
      const valor = parseFloat(valorInput)
      const novoSaldo = (modalPagamento.saldo_credito || 0) + valor
      
      const dataHoje = new Date().toLocaleDateString('pt-BR')
      const novaLinhaObs = `[${dataHoje}] PAGAMENTO: R$ ${valor.toFixed(2)}${observacaoInput ? ' - ' + observacaoInput : ''}`
      const obsAtualizada = modalPagamento.observacoes ? `${novaLinhaObs}\n${modalPagamento.observacoes}` : novaLinhaObs

      await supabase.from('clientes').update({ saldo_credito: novoSaldo, observacoes: obsAtualizada }).eq('id', modalPagamento.id)

      alert('Pagamento registrado!')
      setModalPagamento(null)
      setValorInput(''); setObservacaoInput('')
      buscarDadosFinanceiros()
    } catch (error) {
      alert('Erro ao pagar')
    } finally {
      setSalvando(false)
    }
  }

  const adicionarDivida = async () => {
    setSalvando(true)
    try {
        const dataHoje = new Date().toLocaleDateString('pt-BR')

        // MODO 1: DÍVIDA EM DINHEIRO (SALDO DEVEDOR)
        if (abaDivida === 0) {
            if (!valorInput || parseFloat(valorInput) <= 0) return alert('Digite um valor!')
            
            const valor = parseFloat(valorInput)
            const novaDivida = (modalDivida.saldo_devedor_inicial || 0) + valor
            const novaLinhaObs = `[${dataHoje}] DÍVIDA $$: R$ ${valor.toFixed(2)}${observacaoInput ? ' - ' + observacaoInput : ''}`
            const obsAtualizada = modalDivida.observacoes ? `${novaLinhaObs}\n${modalDivida.observacoes}` : novaLinhaObs

            await supabase.from('clientes').update({ saldo_devedor_inicial: novaDivida, observacoes: obsAtualizada }).eq('id', modalDivida.id)
        } 
        
        // MODO 2: DÍVIDA EM PRODUTO (CRIA VENDA FIADO)
        else {
            if (!produtoDividaId || qtdDivida <= 0) return alert('Selecione produto e quantidade!')
            
            // 1. Cria a venda "pendente" (data de hoje)
            const { data: venda, error: errVenda } = await supabase.from('vendas').insert([{
                id_cliente: modalDivida.id,
                data_venda: new Date().toISOString(),
                forma_pagamento: 'fiado',
                status_pagamento: 'pendente' // <--- O segredo está aqui
            }]).select().single()

            if (errVenda) throw errVenda

            // 2. Descobre o preço ATUAL para registrar (apenas referência, pois o cálculo de dívida é dinâmico)
            const produto = produtos.find(p => p.id === parseInt(produtoDividaId))
            const precoEspecial = listaPrecos.find(p => p.id_cliente === modalDivida.id && p.id_produto === produto.id)
            const precoPraticado = precoEspecial ? precoEspecial.preco_acordado : produto.preco_padrao

            // 3. Insere o item e BAIXA ESTOQUE (Pois se ele deve produto, ele levou produto)
            await supabase.from('itens_venda').insert([{
                id_venda: venda.id,
                id_produto: parseInt(produtoDividaId),
                quantidade: parseInt(qtdDivida),
                preco_praticado: precoPraticado
            }])

            // Baixa estoque
            await supabase.from('produtos').update({ estoque_atual: produto.estoque_atual - parseInt(qtdDivida) }).eq('id', parseInt(produtoDividaId))

            // Anotação Opcional no histórico
            if (observacaoInput) {
                const novaLinhaObs = `[${dataHoje}] FIADO MANUAL: ${qtdDivida}x ${produto.nome} - ${observacaoInput}`
                const obsAtualizada = modalDivida.observacoes ? `${novaLinhaObs}\n${modalDivida.observacoes}` : novaLinhaObs
                await supabase.from('clientes').update({ observacoes: obsAtualizada }).eq('id', modalDivida.id)
            }
        }

        alert('Dívida adicionada com sucesso!')
        setModalDivida(null)
        setValorInput(''); setObservacaoInput(''); setProdutoDividaId(''); setQtdDivida(1)
        buscarDadosFinanceiros()

    } catch (error) {
        console.error(error)
        alert('Erro ao adicionar dívida')
    } finally {
        setSalvando(false)
    }
  }

  const salvarNovoCliente = async () => {
    if (!novoCliente.nome) return alert('O nome é obrigatório!')
    setSalvando(true)
    try {
      const { data: clienteCriado, error: erroCliente } = await supabase.from('clientes').insert([novoCliente]).select().single()
      if (erroCliente) throw erroCliente
      
      const idCliente = clienteCriado.id
      if (novoCliente.tipo !== 'cidade' && Object.keys(precosEspeciaisInput).length > 0) {
        const listaPrecos = []
        Object.entries(precosEspeciaisInput).forEach(([idProd, valor]) => {
            if (valor && parseFloat(valor) > 0) {
                listaPrecos.push({ id_cliente: idCliente, id_produto: parseInt(idProd), preco_acordado: parseFloat(valor) })
            }
        })
        if (listaPrecos.length > 0) await supabase.from('precos_personalizados').insert(listaPrecos)
      }
      alert('Cliente cadastrado!')
      setModalNovoCliente(false)
      setNovoCliente({ nome: '', telefone: '', endereco: '', tipo: 'cidade' })
      setPrecosEspeciaisInput({})
      buscarDadosFinanceiros()
    } catch (error) {
      console.error(error)
      alert('Erro ao cadastrar.')
    } finally {
      setSalvando(false)
    }
  }
  
  const handlePrecoChange = (idProduto, valor) => setPrecosEspeciaisInput(prev => ({ ...prev, [idProduto]: valor }))

  if (carregando) return <Container style={{marginTop:'2rem', textAlign:'center'}}><CircularProgress /></Container>

  return (
    <Container maxWidth="sm" style={{ marginTop: '1rem', paddingBottom: '100px' }}>
      
      <Box display="flex" alignItems="center" marginBottom={2}>
        <IconButton onClick={aoVoltar} edge="start" style={{ marginRight: 10 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" style={{ fontWeight: 'bold' }}>Gestão de Clientes</Typography>
      </Box>

      {/* FILTROS */}
      <Paper elevation={0} style={{ padding: '10px', backgroundColor: '#f5f5f5', marginBottom: '1rem', borderRadius: '10px' }}>
        <TextField 
          fullWidth variant="outlined" placeholder="Buscar..." value={termoBusca}
          onChange={(e) => setTermoBusca(e.target.value)} size="small"
          InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon color="action" /></InputAdornment>) }}
          style={{ backgroundColor: '#fff', marginBottom: '10px' }}
        />
        <Stack direction="row" spacing={1} style={{ overflowX: 'auto', paddingBottom: '5px' }}>
          <Chip icon={<FilterListIcon />} label="Só Devedores" onClick={() => setFiltroStatus(filtroStatus === 'todos' ? 'devedores' : 'todos')} color={filtroStatus === 'devedores' ? 'error' : 'default'} variant={filtroStatus === 'devedores' ? 'filled' : 'outlined'} />
          <div style={{ width: '1px', backgroundColor: '#ccc', margin: '0 5px' }}></div>
          <Chip label="Todos" onClick={() => setFiltroTipo('todos')} color={filtroTipo === 'todos' ? 'primary' : 'default'} variant={filtroTipo === 'todos' ? 'filled' : 'outlined'} />
          <Chip icon={<HomeIcon />} label="Cidade" onClick={() => setFiltroTipo('cidade')} color={filtroTipo === 'cidade' ? 'primary' : 'default'} variant={filtroTipo === 'cidade' ? 'filled' : 'outlined'} />
          <Chip icon={<StoreIcon />} label="Comércio" onClick={() => setFiltroTipo('comercio')} color={filtroTipo === 'comercio' ? 'primary' : 'default'} variant={filtroTipo === 'comercio' ? 'filled' : 'outlined'} />
          <Chip icon={<AgricultureIcon />} label="Sítio" onClick={() => setFiltroTipo('sitio')} color={filtroTipo === 'sitio' ? 'primary' : 'default'} variant={filtroTipo === 'sitio' ? 'filled' : 'outlined'} />
          <Chip icon={<AccountBalanceIcon />} label="Prefeitura" onClick={() => setFiltroTipo('prefeitura')} color={filtroTipo === 'prefeitura' ? 'primary' : 'default'} variant={filtroTipo === 'prefeitura' ? 'filled' : 'outlined'} />
        </Stack>
      </Paper>

      {/* LISTA */}
      <Stack spacing={2}>
        {clientesFiltrados.length === 0 ? (
          <Typography align="center" color="textSecondary" style={{ marginTop: 20 }}>Nenhum cliente encontrado.</Typography>
        ) : (
          clientesFiltrados.map(cliente => (
            <Paper 
              key={cliente.id} elevation={2}
              style={{ padding: '1rem', borderLeft: cliente.divida > 0.01 ? '6px solid #d32f2f' : '6px solid #2e7d32' }}
            >
              <Box display="flex" justifyContent="space-between" alignItems="center">
                
                {/* LADO ESQUERDO */}
                <Box onClick={() => aoClicarCliente(cliente)} style={{ cursor: 'pointer', flex: 1 }}>
                  <Typography variant="h6" style={{ fontSize: '1.1rem', fontWeight: 600 }}>{cliente.nome}</Typography>
                  <Box display="flex" gap={1} alignItems="center">
                    <Typography variant="caption" style={{ backgroundColor: '#eee', padding: '2px 6px', borderRadius: '4px' }}>
                      {cliente.tipo.toUpperCase()}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">{cliente.endereco}</Typography>
                  </Box>
                  {cliente.divida > 0.01 ? (
                    <Box mt={1}>
                      <Typography variant="body2" color="error" style={{ fontWeight: 'bold' }}>Devendo: R$ {cliente.divida.toFixed(2)}</Typography>
                      <Typography variant="caption" color="textSecondary" display="block">
                        {cliente.itensResumo.join(', ')}
                      </Typography>
                    </Box>
                  ) : (
                    <Typography variant="caption" style={{ color: 'green', fontWeight: 'bold', display:'block', marginTop:5 }}>✓ Tudo certo</Typography>
                  )}
                </Box>
                
                {/* LADO DIREITO */}
                <Box display="flex" alignItems="center">
                  <Tooltip title="Ver Perfil/Histórico">
                    <IconButton onClick={() => aoClicarCliente(cliente)} color="default">
                      <VisibilityIcon />
                    </IconButton>
                  </Tooltip>

                  {cliente.divida > 0.01 && (
                    <Tooltip title="Registrar Pagamento">
                      <IconButton 
                        style={{ color: '#1976d2', marginLeft: 2 }} 
                        onClick={(e) => { e.stopPropagation(); setModalPagamento(cliente); setValorInput(''); setObservacaoInput(''); }}
                      >
                        <AttachMoneyIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                  
                  <Tooltip title="Adicionar Dívida Manual">
                    <IconButton 
                      style={{ color: '#d32f2f', marginLeft: 2 }} 
                      onClick={(e) => { e.stopPropagation(); setModalDivida(cliente); setValorInput(''); setObservacaoInput(''); setAbaDivida(0); setProdutoDividaId(''); }}
                    >
                      <MoneyOffIcon />
                    </IconButton>
                  </Tooltip>
                </Box>

              </Box>
            </Paper>
          ))
        )}
      </Stack>

      <Fab color="primary" style={{ position: 'fixed', bottom: 20, right: 20 }} onClick={() => setModalNovoCliente(true)}>
        <AddIcon />
      </Fab>

      {/* MODAL NOVO CLIENTE */}
      <Dialog open={modalNovoCliente} onClose={() => setModalNovoCliente(false)} fullWidth>
        <DialogTitle>Novo Cliente</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField label="Nome" fullWidth autoFocus value={novoCliente.nome} onChange={(e) => setNovoCliente({...novoCliente, nome: e.target.value})} />
            <TextField label="Endereço" fullWidth value={novoCliente.endereco} onChange={(e) => setNovoCliente({...novoCliente, endereco: e.target.value})} />
            <TextField label="Telefone" fullWidth value={novoCliente.telefone} onChange={(e) => setNovoCliente({...novoCliente, telefone: e.target.value})} />
            <TextField select label="Tipo" fullWidth value={novoCliente.tipo} onChange={(e) => setNovoCliente({...novoCliente, tipo: e.target.value})} SelectProps={{ native: true }}>
              <option value="cidade">Cidade</option><option value="comercio">Comércio</option><option value="sitio">Sítio</option><option value="prefeitura">Prefeitura</option>
            </TextField>
            {novoCliente.tipo !== 'cidade' && (
                <Box style={{ backgroundColor: '#f0f7ff', padding: '15px', borderRadius: '8px', border: '1px solid #1976d2' }}>
                    <Typography variant="subtitle2" color="primary" style={{ fontWeight: 'bold', marginBottom: '10px' }}>Tabela de Preços</Typography>
                    <Stack spacing={2}>
                        {produtos.map(prod => (
                            <Box key={prod.id} display="flex" alignItems="center" gap={2}>
                                <Typography variant="body2" style={{ minWidth: '80px' }}>{prod.nome}</Typography>
                                <TextField label={`Padrão: ${prod.preco_padrao}`} type="number" size="small" fullWidth value={precosEspeciaisInput[prod.id] || ''} onChange={(e) => handlePrecoChange(prod.id, e.target.value)} InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }} />
                            </Box>
                        ))}
                    </Stack>
                </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalNovoCliente(false)}>Cancelar</Button>
          <Button onClick={salvarNovoCliente} variant="contained" disabled={salvando}>Salvar</Button>
        </DialogActions>
      </Dialog>
      
      {/* MODAL PAGAMENTO (RECEBER) */}
      <Dialog open={!!modalPagamento} onClose={() => setModalPagamento(null)} fullWidth>
        <DialogTitle>Receber de {modalPagamento?.nome}</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>Total Devido: <strong>R$ {modalPagamento?.divida.toFixed(2)}</strong></Typography>
          <Stack spacing={2} mt={1}>
            <TextField 
                label="Valor a Receber" 
                type="number" 
                fullWidth 
                autoFocus
                value={valorInput} 
                onChange={(e) => setValorInput(e.target.value)} 
                InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }}
            />
            <TextField
                label="Anotação (Opcional)"
                placeholder="Ex: Pix da esposa; Parte em dinheiro..."
                fullWidth
                multiline
                rows={2}
                value={observacaoInput}
                onChange={(e) => setObservacaoInput(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><NoteAddIcon color="action" /></InputAdornment> }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalPagamento(null)}>Cancelar</Button>
          <Button onClick={realizarPagamento} variant="contained" color="success">Confirmar</Button>
        </DialogActions>
      </Dialog>

      {/* MODAL ADICIONAR DÍVIDA (COBRAR) - AGORA COM ABAS */}
      <Dialog open={!!modalDivida} onClose={() => setModalDivida(null)} fullWidth>
        <DialogTitle style={{ color: '#d32f2f' }}>Adicionar Dívida para {modalDivida?.nome}</DialogTitle>
        <DialogContent>
          
          <Tabs value={abaDivida} onChange={(e, v) => setAbaDivida(v)} variant="fullWidth" style={{ marginBottom: 20 }}>
            <Tab icon={<AttachMoneyIcon />} label="Em Dinheiro" />
            <Tab icon={<LocalGasStationIcon />} label="Em Produto" />
          </Tabs>

          {/* ABA 0: DINHEIRO (VALOR FIXO) */}
          {abaDivida === 0 && (
              <Stack spacing={2} mt={1}>
                <Typography variant="body2" color="textSecondary">
                    Use para empréstimos em dinheiro ou cobranças antigas. O valor é <b>fixo</b>.
                </Typography>
                <TextField 
                    label="Valor da Dívida" 
                    type="number" 
                    fullWidth 
                    autoFocus
                    value={valorInput} 
                    onChange={(e) => setValorInput(e.target.value)} 
                    InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }}
                />
              </Stack>
          )}

          {/* ABA 1: PRODUTO (VALOR DINÂMICO) */}
          {abaDivida === 1 && (
              <Stack spacing={2} mt={1}>
                <Typography variant="body2" color="textSecondary">
                    Lança como <b>Venda Fiado</b>. Se o preço do produto subir, a dívida <b>sobe junto</b>.
                </Typography>
                <TextField 
                    select 
                    label="Produto" 
                    fullWidth 
                    value={produtoDividaId} 
                    onChange={(e) => setProdutoDividaId(e.target.value)}
                >
                    {produtos.map(p => <MenuItem key={p.id} value={p.id}>{p.nome}</MenuItem>)}
                </TextField>
                
                <TextField 
                    label="Quantidade" 
                    type="number" 
                    fullWidth 
                    value={qtdDivida} 
                    onChange={(e) => setQtdDivida(e.target.value)} 
                />
              </Stack>
          )}

          <TextField
                label="Motivo / Anotação (Opcional)"
                placeholder="Ex: Empréstimo pessoal..."
                fullWidth
                multiline
                rows={2}
                value={observacaoInput}
                onChange={(e) => setObservacaoInput(e.target.value)}
                style={{ marginTop: 20 }}
                InputProps={{ startAdornment: <InputAdornment position="start"><NoteAddIcon color="action" /></InputAdornment> }}
            />

        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalDivida(null)}>Cancelar</Button>
          <Button onClick={adicionarDivida} variant="contained" color="error">Adicionar</Button>
        </DialogActions>
      </Dialog>

    </Container>
  )
}

export default Clientes