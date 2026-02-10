import { useState, useEffect } from 'react'
import { Container, Typography, Button, Paper, Stack, Box, TextField, IconButton, Divider, CircularProgress, InputAdornment, Chip } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditIcon from '@mui/icons-material/Edit'
import SaveIcon from '@mui/icons-material/Save'
import DeleteIcon from '@mui/icons-material/Delete'
import NoteIcon from '@mui/icons-material/Note'
import { supabase } from './supabaseClient'

function PerfilCliente({ cliente, aoVoltar }) {
  const [historico, setHistorico] = useState([])
  const [produtos, setProdutos] = useState([])
  const [carregando, setCarregando] = useState(true)
  
  const [editando, setEditando] = useState(false)
  // Inicialização segura
  const [dadosEdicao, setDadosEdicao] = useState({ 
    ...cliente, 
    tipo: cliente.tipo || 'cidade', 
    observacoes: cliente.observacoes || '' 
  })
  
  const [precosEdicao, setPrecosEdicao] = useState({})

  useEffect(() => {
    buscarDadosCompletos()
  }, [cliente])

  async function buscarDadosCompletos() {
    setCarregando(true)
    
    // 1. Busca Histórico
    const { data: dataVendas } = await supabase
      .from('vendas')
      .select(`
        id, data_venda, status_pagamento, forma_pagamento,
        itens_venda ( quantidade, preco_praticado, produtos ( nome ) )
      `)
      .eq('id_cliente', cliente.id)
      .order('data_venda', { ascending: false })

    if (dataVendas) setHistorico(dataVendas)

    // 2. Busca Produtos
    const { data: dataProds } = await supabase.from('produtos').select('*').order('id')
    if (dataProds) setProdutos(dataProds)

    // 3. Busca Dados Atualizados
    const { data: clienteAtualizado } = await supabase.from('clientes').select('*').eq('id', cliente.id).single()
    if (clienteAtualizado) {
        setDadosEdicao({
            ...clienteAtualizado,
            tipo: clienteAtualizado.tipo || 'cidade',
            observacoes: clienteAtualizado.observacoes || ''
        })
    }

    // 4. Busca Preços
    const { data: dataPrecos } = await supabase.from('precos_personalizados').select('*').eq('id_cliente', cliente.id)
    const mapaPrecos = {}
    if (dataPrecos) {
      dataPrecos.forEach(p => mapaPrecos[p.id_produto] = p.preco_acordado)
    }
    setPrecosEdicao(mapaPrecos)

    setCarregando(false)
  }

  // --- SALVAR EDIÇÃO ---
  async function salvarEdicao() {
    try {
        const { error: erroCliente } = await supabase
        .from('clientes')
        .update({
            nome: dadosEdicao.nome,
            telefone: dadosEdicao.telefone,
            endereco: dadosEdicao.endereco,
            tipo: dadosEdicao.tipo,
            observacoes: dadosEdicao.observacoes
        })
        .eq('id', cliente.id)

        if (erroCliente) throw erroCliente

        // Atualiza Preços
        if (dadosEdicao.tipo === 'cidade') {
            await supabase.from('precos_personalizados').delete().eq('id_cliente', cliente.id)
        } else {
            for (const prod of produtos) {
                const valorDigitado = precosEdicao[prod.id]
                if (valorDigitado && parseFloat(valorDigitado) > 0) {
                    await supabase.from('precos_personalizados').upsert({
                        id_cliente: cliente.id, id_produto: prod.id, preco_acordado: parseFloat(valorDigitado)
                    }, { onConflict: 'id_cliente, id_produto' })
                } else {
                    await supabase.from('precos_personalizados').delete().match({ id_cliente: cliente.id, id_produto: prod.id })
                }
            }
        }

        alert('Perfil atualizado!')
        setEditando(false)
        buscarDadosCompletos() 

    } catch (error) {
        console.error(error)
        alert('Erro ao atualizar.')
    }
  }

  // --- EXCLUIR CLIENTE (COM FORÇA BRUTA) ---
  async function excluirCliente() {
      const confirmacao = window.confirm(`ATENÇÃO TOTAL:\n\nVocê vai apagar o cliente "${dadosEdicao.nome}" e TODO o histórico de vendas dele.\n\nIsso é útil para testes, mas cuidado: o financeiro desse cliente vai sumir.\n\nTem certeza?`)
      
      if (confirmacao) {
          try {
              // 1. Buscar todas as vendas desse cliente para apagar os itens primeiro
              const { data: vendas } = await supabase.from('vendas').select('id').eq('id_cliente', cliente.id)
              
              const idsVendas = vendas.map(v => v.id)

              if (idsVendas.length > 0) {
                  // Apaga itens das vendas
                  await supabase.from('itens_venda').delete().in('id_venda', idsVendas)
                  // Apaga as vendas
                  await supabase.from('vendas').delete().in('id', idsVendas)
              }

              // 2. Apaga tabela de preços personalizada
              await supabase.from('precos_personalizados').delete().eq('id_cliente', cliente.id)

              // 3. Finalmente, apaga o cliente
              const { error } = await supabase.from('clientes').delete().eq('id', cliente.id)
              
              if (error) throw error

              alert('Cliente e histórico excluídos com sucesso!')
              aoVoltar()

          } catch (error) {
              console.error(error)
              alert('Erro ao excluir. Verifique o console.')
          }
      }
  }

  const handlePrecoChange = (idProduto, valor) => setPrecosEdicao(prev => ({ ...prev, [idProduto]: valor }))
  const formatarData = (dataISO) => new Date(dataISO).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit' })
  const calcularTotalVenda = (itens) => itens ? itens.reduce((acc, item) => acc + (item.quantidade * item.preco_praticado), 0) : 0

  if (carregando) return <Container style={{marginTop:'2rem', textAlign:'center'}}><CircularProgress /></Container>
  if (!dadosEdicao) return null 

  return (
    <Container maxWidth="sm" style={{ marginTop: '1rem', paddingBottom: '50px' }}>
      
      <Box display="flex" alignItems="center" marginBottom={2}>
        <IconButton onClick={aoVoltar} style={{ marginRight: 10 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6">Perfil do Cliente</Typography>
      </Box>

      <Paper elevation={3} style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h5" style={{ fontWeight: 'bold', color: '#1976d2' }}>
            {editando ? 'Editando...' : dadosEdicao.nome}
          </Typography>
          <IconButton onClick={() => editando ? salvarEdicao() : setEditando(true)} color="primary" style={{ backgroundColor: editando ? '#e3f2fd' : 'transparent' }}>
            {editando ? <SaveIcon /> : <EditIcon />}
          </IconButton>
        </Box>

        <Stack spacing={2}>
          {editando ? (
            <>
              <TextField label="Nome" fullWidth value={dadosEdicao.nome || ''} onChange={e => setDadosEdicao({...dadosEdicao, nome: e.target.value})} />
              <TextField label="Telefone" fullWidth value={dadosEdicao.telefone || ''} onChange={e => setDadosEdicao({...dadosEdicao, telefone: e.target.value})} />
              <TextField label="Endereço" fullWidth value={dadosEdicao.endereco || ''} onChange={e => setDadosEdicao({...dadosEdicao, endereco: e.target.value})} />
              
              <TextField select label="Tipo" fullWidth value={dadosEdicao.tipo || 'cidade'} onChange={e => setDadosEdicao({...dadosEdicao, tipo: e.target.value})} SelectProps={{ native: true }}>
                 <option value="cidade">Cidade (Residencial)</option>
                 <option value="comercio">Comércio</option>
                 <option value="sitio">Sítio</option>
                 <option value="prefeitura">Prefeitura</option>
              </TextField>

              <TextField 
                label="Observações" multiline rows={3} fullWidth
                value={dadosEdicao.observacoes || ''}
                onChange={e => setDadosEdicao({...dadosEdicao, observacoes: e.target.value})}
                style={{ backgroundColor: '#fff9c4' }}
              />

              {dadosEdicao.tipo !== 'cidade' && (
                <Box style={{ backgroundColor: '#f5f5f5', padding: '15px', borderRadius: '8px', border: '1px solid #ccc' }}>
                    <Typography variant="subtitle2" style={{ fontWeight: 'bold', marginBottom: '10px' }}>Tabela de Preços</Typography>
                    <Stack spacing={2}>
                        {produtos.map(prod => (
                            <Box key={prod.id} display="flex" alignItems="center" gap={2}>
                                <Typography variant="body2" style={{ minWidth: '90px', fontWeight: 'bold' }}>{prod.nome}</Typography>
                                <TextField label={`Padrão: ${prod.preco_padrao}`} placeholder="Especial" type="number" size="small" fullWidth value={precosEdicao[prod.id] || ''} onChange={(e) => handlePrecoChange(prod.id, e.target.value)} InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }} style={{ backgroundColor: '#fff' }} />
                            </Box>
                        ))}
                    </Stack>
                </Box>
              )}

              <Box mt={2} pt={2} borderTop="1px solid #eee">
                  <Button variant="outlined" color="error" startIcon={<DeleteIcon />} fullWidth onClick={excluirCliente}>
                      Excluir Cliente e Histórico (Modo Teste)
                  </Button>
              </Box>
            </>
          ) : (
            <>
              <Typography><strong>Endereço:</strong> {dadosEdicao.endereco || 'Não informado'}</Typography>
              <Typography><strong>Telefone:</strong> {dadosEdicao.telefone || 'Não informado'}</Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography><strong>Tipo:</strong> {(dadosEdicao.tipo || 'cidade').toUpperCase()}</Typography>
                {Object.keys(precosEdicao).length > 0 && (
                    <Chip label="Tabela Especial" size="small" color="success" variant="outlined" />
                )}
              </Box>

              {dadosEdicao.observacoes && (
                  <Paper elevation={0} style={{ backgroundColor: '#fff9c4', padding: '10px', marginTop: '10px', borderLeft: '4px solid #fbc02d' }}>
                      <Box display="flex" gap={1} mb={0.5}>
                          <NoteIcon style={{ color: '#f57f17', fontSize: 20 }} />
                          <Typography variant="caption" style={{ fontWeight: 'bold', color: '#f57f17' }}>OBSERVAÇÕES:</Typography>
                      </Box>
                      <Typography variant="body2" style={{ whiteSpace: 'pre-line' }}>{dadosEdicao.observacoes}</Typography>
                  </Paper>
              )}
            </>
          )}
        </Stack>
      </Paper>

      <Typography variant="h6" gutterBottom style={{ fontWeight: 'bold', marginTop: '2rem' }}>
        Extrato de Compras
      </Typography>

      {carregando ? <CircularProgress /> : (
        <Stack spacing={2}>
          {historico.length === 0 ? <Typography color="textSecondary">Nenhuma compra registrada.</Typography> : 
            historico.map(venda => (
              <Paper key={venda.id} style={{ padding: '1rem', borderLeft: venda.status_pagamento === 'pendente' ? '4px solid red' : '4px solid green' }}>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="caption" color="textSecondary">{formatarData(venda.data_venda)}</Typography>
                  <Typography variant="caption" style={{ fontWeight: 'bold' }}>
                    {venda.status_pagamento === 'pendente' ? 'FIADO' : 'PAGO'} ({venda.forma_pagamento})
                  </Typography>
                </Box>
                <Box mt={1} mb={1}>
                  {venda.itens_venda.map((item, index) => (
                    <Typography key={index} variant="body2">• {item.quantidade}x {item.produtos?.nome} (R$ {item.preco_praticado})</Typography>
                  ))}
                </Box>
                <Divider />
                <Box display="flex" justifyContent="space-between" mt={1}>
                  <Typography variant="body2">Total:</Typography>
                  <Typography variant="body1" style={{ fontWeight: 'bold' }}>R$ {calcularTotalVenda(venda.itens_venda).toFixed(2)}</Typography>
                </Box>
              </Paper>
            ))
          }
        </Stack>
      )}
    </Container>
  )
}

export default PerfilCliente