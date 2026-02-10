import { useState, useEffect } from 'react'
import { Container, Typography, Button, Paper, Stack, Box, Grid, CircularProgress, LinearProgress, FormControl, InputLabel, Select, MenuItem, Card, CardContent, IconButton, Fab, Dialog, DialogTitle, DialogContent, DialogActions, TextField, InputAdornment, Tabs, Tab, Divider, Chip, Alert, List, ListItem, ListItemText } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import InventoryIcon from '@mui/icons-material/Inventory'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong' // Ícone do Extrato
import RestoreIcon from '@mui/icons-material/Restore'
import AddCircleIcon from '@mui/icons-material/AddCircle'
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle'
import PriceChangeIcon from '@mui/icons-material/PriceChange'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import FilterAltIcon from '@mui/icons-material/FilterAlt'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
import { supabase } from './supabaseClient'

function Gerenciamento({ aoVoltar }) {
  const [tabAtual, setTabAtual] = useState(0) 
  const [carregando, setCarregando] = useState(true)
  
  // --- DASHBOARD (MÉTRICAS) ---
  const [mesSelecionado, setMesSelecionado] = useState(new Date().getMonth())
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear())
  const [vendasBrutas, setVendasBrutas] = useState([]) 
  const [filtroRegiao, setFiltroRegiao] = useState('todos')
  const [metricas, setMetricas] = useState({ faturamentoTotal: 0, qtdVendas: 0, porProduto: {}, porPagamento: {}, porRegiao: {} })

  // --- EXTRATO DE CONFERÊNCIAS ---
  const [historicoConferencias, setHistoricoConferencias] = useState([])

  // --- EXTRATO DIÁRIO (NOVA FUNCIONALIDADE) ---
  const [dataExtrato, setDataExtrato] = useState(new Date().toISOString().split('T')[0]) // Data de Hoje
  const [extratoDia, setExtratoDia] = useState({ vendas: [], recebimentos: [], totalVendas: 0, totalRecebimentos: 0 })

  // Auxiliares e Modais
  const [listaClientes, setListaClientes] = useState([])
  const [listaProdutos, setListaProdutos] = useState([])
  const [listaPrecos, setListaPrecos] = useState([])

  const [modalRetroativo, setModalRetroativo] = useState(false)
  const [dataRetroativa, setDataRetroativa] = useState(new Date().toISOString().split('T')[0])
  const [clienteRetroativo, setClienteRetroativo] = useState('')
  const [carrinhoRetroativo, setCarrinhoRetroativo] = useState({}) 
  const [pagamentoRetroativo, setPagamentoRetroativo] = useState('dinheiro')
  const [salvandoRetroativo, setSalvandoRetroativo] = useState(false)

  const [modalPrecos, setModalPrecos] = useState(false)
  const [novosPrecos, setNovosPrecos] = useState({})
  const [salvandoPrecos, setSalvandoPrecos] = useState(false)

  // Carrega dados iniciais e Dashboard
  useEffect(() => {
    carregarDados()
  }, [mesSelecionado, anoSelecionado, tabAtual])

  // Recalcula métricas do Dashboard quando filtro muda
  useEffect(() => {
    if (vendasBrutas.length > 0 || !carregando) {
        processarMetricas(vendasBrutas)
    }
  }, [vendasBrutas, filtroRegiao])

  // Carrega Extrato Diário quando muda a Data ou a Aba
  useEffect(() => {
    if (tabAtual === 2) {
        carregarExtratoDia()
    }
  }, [dataExtrato, tabAtual])

  async function carregarDados() {
    setCarregando(true)
    
    // 1. Dashboard (Mês inteiro)
    const dataInicio = new Date(anoSelecionado, mesSelecionado, 1).toISOString()
    const dataFim = new Date(anoSelecionado, mesSelecionado + 1, 0, 23, 59, 59).toISOString()
    
    const { data: dadosVendas } = await supabase
      .from('vendas')
      .select(`id, data_venda, forma_pagamento, status_pagamento, clientes ( tipo ), itens_venda ( quantidade, preco_praticado, produtos ( nome ) )`)
      .gte('data_venda', dataInicio)
      .lte('data_venda', dataFim)

    if (dadosVendas) setVendasBrutas(dadosVendas)

    // 2. Extrato de Conferências
    if (tabAtual === 1) {
        const { data: conferencias } = await supabase.from('historico_conferencias').select('*').order('data_conferencia', { ascending: false }).limit(50) 
        if (conferencias) agruparConferencias(conferencias)
    }

    // Listas Auxiliares
    const { data: cli } = await supabase.from('clientes').select('*')
    const { data: prod } = await supabase.from('produtos').select('*').order('id')
    const { data: prec } = await supabase.from('precos_personalizados').select('*')
    
    if (cli) setListaClientes(cli)
    if (prod) { 
        setListaProdutos(prod)
        const pi = {}; prod.forEach(p => pi[p.id] = p.preco_padrao); setNovosPrecos(pi) 
    }
    if (prec) setListaPrecos(prec)

    setCarregando(false)
  }

  // --- NOVA FUNÇÃO: CARREGAR EXTRATO DO DIA ---
  async function carregarExtratoDia() {
      setCarregando(true)
      
      // 1. Buscar Vendas do Dia
      const inicioDia = `${dataExtrato}T00:00:00`
      const fimDia = `${dataExtrato}T23:59:59`

      const { data: vendasDia } = await supabase
          .from('vendas')
          .select(`id, data_venda, forma_pagamento, clientes ( nome, tipo ), itens_venda ( quantidade, preco_praticado, produtos ( nome ) )`)
          .gte('data_venda', inicioDia)
          .lte('data_venda', fimDia)
          .order('data_venda', { ascending: false })

      // Calcular Total de Vendas
      let totalVendas = 0
      const listaVendas = vendasDia || []
      listaVendas.forEach(v => {
          const totalV = v.itens_venda.reduce((acc, item) => acc + (item.quantidade * item.preco_praticado), 0)
          v.total = totalV
          totalVendas += totalV
      })

      // 2. Buscar Recebimentos (Varrendo observações dos clientes)
      // Como não temos tabela de pagamentos, buscamos nas observações que contêm a data
      const dataFormatada = new Date(dataExtrato + 'T12:00:00').toLocaleDateString('pt-BR') // Ex: 10/02/2026
      
      const { data: clientesComObs } = await supabase
          .from('clientes')
          .select('id, nome, observacoes')
          .ilike('observacoes', `%[${dataFormatada}] PAGAMENTO%`) // Busca texto específico

      let totalRecebimentos = 0
      const listaRecebimentos = []

      if (clientesComObs) {
          clientesComObs.forEach(cli => {
              // Quebra as linhas da observação para achar a linha do pagamento
              const linhas = cli.observacoes.split('\n')
              linhas.forEach(linha => {
                  if (linha.includes(`[${dataFormatada}] PAGAMENTO`)) {
                      // Extrai o valor da string "R$ 50.00"
                      try {
                          const parteValor = linha.split('R$ ')[1].split(' ')[0] // Pega o número logo depois do R$
                          const valor = parseFloat(parteValor)
                          const obsExtra = linha.split('- ')[1] || '' // Pega o comentário se houver

                          if (!isNaN(valor)) {
                              totalRecebimentos += valor
                              listaRecebimentos.push({
                                  cliente: cli.nome,
                                  valor: valor,
                                  obs: obsExtra
                              })
                          }
                      } catch (e) {
                          console.log('Erro ao ler linha:', linha)
                      }
                  }
              })
          })
      }

      setExtratoDia({
          vendas: listaVendas,
          recebimentos: listaRecebimentos,
          totalVendas,
          totalRecebimentos
      })

      setCarregando(false)
  }

  function processarMetricas(dados) {
    let totalFat = 0; let totalQtd = 0; const prodCount = {}; const pagCount = {}; const regiaoCount = {}
    const dadosFiltrados = dados.filter(venda => {
        if (filtroRegiao === 'todos') return true
        return venda.clientes?.tipo === filtroRegiao
    })
    totalQtd = dadosFiltrados.length
    dadosFiltrados.forEach(venda => {
      venda.itens_venda.forEach(item => {
        totalFat += (item.quantidade * item.preco_praticado)
        const nomeProd = item.produtos?.nome || 'Outros'
        prodCount[nomeProd] = (prodCount[nomeProd] || 0) + item.quantidade
      })
      const totalVenda = venda.itens_venda.reduce((acc, i) => acc + (i.quantidade * i.preco_praticado), 0)
      const metodo = venda.forma_pagamento || 'Outros'
      pagCount[metodo] = (pagCount[metodo] || 0) + totalVenda
      const regiao = venda.clientes?.tipo || 'Outros'
      regiaoCount[regiao] = (regiaoCount[regiao] || 0) + 1
    })
    setMetricas({ faturamentoTotal: totalFat, qtdVendas: totalQtd, porProduto: prodCount, porPagamento: pagCount, porRegiao: regiaoCount })
  }

  function agruparConferencias(listaBruta) {
      const grupos = {}
      listaBruta.forEach(item => {
          const dataHora = new Date(item.data_conferencia).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
          if (!grupos[dataHora]) grupos[dataHora] = { data: dataHora, itens: [], temErro: false }
          grupos[dataHora].itens.push(item)
          if (item.status === 'divergente') grupos[dataHora].temErro = true
      })
      setHistoricoConferencias(Object.values(grupos))
  }

  // Funções Auxiliares (Retroativo/Preços)
  const getPrecoReal = (produto, idCliente) => {
      if (!idCliente) return produto.preco_padrao
      const especial = listaPrecos.find(p => p.id_cliente === idCliente && p.id_produto === produto.id)
      return especial ? especial.preco_acordado : produto.preco_padrao
  }
  const addItem = (prod) => setCarrinhoRetroativo(prev => ({ ...prev, [prod.id]: (prev[prod.id] || 0) + 1 }))
  const removeItem = (prod) => {
      setCarrinhoRetroativo(prev => {
          const nova = (prev[prod.id] || 0) - 1
          if (nova <= 0) { const c = {...prev}; delete c[prod.id]; return c }
          return { ...prev, [prod.id]: nova }
      })
  }
  const calcularTotalRetroativo = () => {
      let total = 0
      listaProdutos.forEach(p => { const qtd = carrinhoRetroativo[p.id] || 0; total += qtd * getPrecoReal(p, clienteRetroativo) })
      return total
  }
  const salvarVendaRetroativa = async () => { 
      if (!clienteRetroativo || Object.keys(carrinhoRetroativo).length === 0 || !dataRetroativa) return alert('Preencha tudo.')
      setSalvandoRetroativo(true)
      try {
          const { data: vendaCriada, error: erroVenda } = await supabase.from('vendas').insert([{ id_cliente: clienteRetroativo, data_venda: `${dataRetroativa}T12:00:00`, forma_pagamento: pagamentoRetroativo, status_pagamento: pagamentoRetroativo === 'fiado' ? 'pendente' : 'pago' }]).select().single()
          if (erroVenda) throw erroVenda
          const itensParaSalvar = []
          Object.entries(carrinhoRetroativo).forEach(([idProd, qtd]) => {
              const produto = listaProdutos.find(p => p.id === parseInt(idProd))
              itensParaSalvar.push({ id_venda: vendaCriada.id, id_produto: parseInt(idProd), quantidade: qtd, preco_praticado: getPrecoReal(produto, clienteRetroativo) })
          })
          await supabase.from('itens_venda').insert(itensParaSalvar)
          alert('Venda retroativa lançada!')
          setModalRetroativo(false); setCarrinhoRetroativo({}); setClienteRetroativo(''); 
          carregarDados(); 
      } catch (error) { console.error(error); alert('Erro.') } finally { setSalvandoRetroativo(false) }
  }
  const salvarNovosPrecos = async () => { 
    setSalvandoPrecos(true)
    try {
        for (const [idProduto, novoValor] of Object.entries(novosPrecos)) {
            const valorFloat = parseFloat(novoValor)
            if (valorFloat > 0) await supabase.from('produtos').update({ preco_padrao: valorFloat }).eq('id', idProduto)
        }
        alert('Tabela atualizada!'); setModalPrecos(false); carregarDados();
    } catch (e) { alert('Erro') } finally { setSalvandoPrecos(false) }
  }
  const handlePriceChangeInput = (id, valor) => setNovosPrecos(prev => ({ ...prev, [id]: valor }))
  const ordenarRanking = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1])

  return (
    <Container maxWidth="sm" style={{ marginTop: '1rem', paddingBottom: '80px' }}>
      
      <Box display="flex" justifyContent="space-between" alignItems="center" marginBottom={1}>
        <IconButton onClick={aoVoltar}><ArrowBackIcon /></IconButton>
        <Typography variant="h6" style={{ fontWeight: 'bold' }}>Gerencial</Typography>
        <Button variant="outlined" size="small" startIcon={<PriceChangeIcon />} onClick={() => setModalPrecos(true)}>Preços</Button>
      </Box>

      <Tabs value={tabAtual} onChange={(e, v) => setTabAtual(v)} variant="fullWidth" style={{ marginBottom: 20 }}>
        <Tab icon={<TrendingUpIcon />} label="Financeiro" />
        <Tab icon={<InventoryIcon />} label="Conferência" />
        <Tab icon={<ReceiptLongIcon />} label="Extrato Dia" /> {/* NOVA ABA */}
      </Tabs>

      {/* === ABA 0: DASHBOARD FINANCEIRO === */}
      {tabAtual === 0 && (
        <>
            <Paper elevation={0} style={{ padding: '10px', backgroundColor: '#f5f5f5', marginBottom: '10px' }}>
                <Grid container spacing={2}>
                    <Grid item xs={8}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Mês</InputLabel>
                            <Select value={mesSelecionado} label="Mês" onChange={(e) => setMesSelecionado(e.target.value)} style={{ backgroundColor: 'white' }}>
                                <MenuItem value={0}>Janeiro</MenuItem><MenuItem value={1}>Fevereiro</MenuItem><MenuItem value={2}>Março</MenuItem><MenuItem value={3}>Abril</MenuItem><MenuItem value={4}>Maio</MenuItem><MenuItem value={5}>Junho</MenuItem><MenuItem value={6}>Julho</MenuItem><MenuItem value={7}>Agosto</MenuItem><MenuItem value={8}>Setembro</MenuItem><MenuItem value={9}>Outubro</MenuItem><MenuItem value={10}>Novembro</MenuItem><MenuItem value={11}>Dezembro</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={4}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Ano</InputLabel>
                            <Select value={anoSelecionado} label="Ano" onChange={(e) => setAnoSelecionado(e.target.value)} style={{ backgroundColor: 'white' }}>
                                <MenuItem value={2024}>2024</MenuItem><MenuItem value={2025}>2025</MenuItem><MenuItem value={2026}>2026</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                </Grid>
            </Paper>

            <Paper elevation={0} style={{ padding: '10px', marginBottom: '20px', overflowX: 'auto' }}>
                <Box display="flex" alignItems="center" gap={1}>
                    <FilterAltIcon color="action" />
                    <Typography variant="caption" style={{fontWeight:'bold'}}>FILTRAR:</Typography>
                    <Chip label="Todos" onClick={() => setFiltroRegiao('todos')} color={filtroRegiao === 'todos' ? 'primary' : 'default'} clickable />
                    <Chip label="Cidade" onClick={() => setFiltroRegiao('cidade')} color={filtroRegiao === 'cidade' ? 'primary' : 'default'} clickable />
                    <Chip label="Sítio" onClick={() => setFiltroRegiao('sitio')} color={filtroRegiao === 'sitio' ? 'primary' : 'default'} clickable />
                    <Chip label="Comércio" onClick={() => setFiltroRegiao('comercio')} color={filtroRegiao === 'comercio' ? 'primary' : 'default'} clickable />
                    <Chip label="Prefeitura" onClick={() => setFiltroRegiao('prefeitura')} color={filtroRegiao === 'prefeitura' ? 'primary' : 'default'} clickable />
                </Box>
            </Paper>

            {carregando ? <CircularProgress /> : (
                <Stack spacing={3}>
                <Grid container spacing={2}>
                    <Grid item xs={6}><Card style={{ backgroundColor: '#e3f2fd' }}><CardContent><Typography variant="caption">FATURAMENTO ({filtroRegiao.toUpperCase()})</Typography><Typography variant="h6" color="primary" style={{ fontWeight: 'bold' }}>R$ {metricas.faturamentoTotal.toFixed(2)}</Typography></CardContent></Card></Grid>
                    <Grid item xs={6}><Card style={{ backgroundColor: '#fff3e0' }}><CardContent><Typography variant="caption">VENDAS ({filtroRegiao.toUpperCase()})</Typography><Typography variant="h6" style={{ color: '#e65100', fontWeight: 'bold' }}>{metricas.qtdVendas}</Typography></CardContent></Card></Grid>
                </Grid>

                <Paper elevation={2} style={{ padding: '15px' }}>
                    <Typography variant="subtitle2" gutterBottom>Ranking</Typography>
                    <Stack spacing={1}>
                        {ordenarRanking(metricas.porProduto).map(([produto, qtd]) => (
                            <Box key={produto}><Box display="flex" justifyContent="space-between"><Typography variant="body2">{produto}</Typography><Typography variant="body2" fontWeight="bold">{qtd}</Typography></Box><LinearProgress variant="determinate" value={(qtd/Math.max(...Object.values(metricas.porProduto),1))*100} /></Box>
                        ))}
                        {Object.keys(metricas.porProduto).length === 0 && <Typography variant="caption">Sem dados.</Typography>}
                    </Stack>
                </Paper>

                <Paper elevation={2} style={{ padding: '15px' }}>
                    <Typography variant="subtitle2" gutterBottom>Pagamentos</Typography>
                    <Stack spacing={1}>
                        {ordenarRanking(metricas.porPagamento).map(([metodo, valor]) => (
                            <Box key={metodo} display="flex" justifyContent="space-between"><Typography variant="body2" style={{ textTransform: 'uppercase' }}>{metodo}</Typography><Typography variant="body2" fontWeight="bold" color="green">R$ {valor.toFixed(2)}</Typography></Box>
                        ))}
                         {Object.keys(metricas.porPagamento).length === 0 && <Typography variant="caption">Sem dados.</Typography>}
                    </Stack>
                </Paper>
                </Stack>
            )}
            
            <Fab variant="extended" color="secondary" style={{ position: 'fixed', bottom: 20, right: 20 }} onClick={() => setModalRetroativo(true)}>
                <RestoreIcon sx={{ mr: 1 }} /> Lançar Passado
            </Fab>
        </>
      )}

      {/* === ABA 1: HISTÓRICO DE CONFERÊNCIAS === */}
      {tabAtual === 1 && (
        <Stack spacing={2}>
             <Alert severity="info" style={{marginBottom: 10}}>Histórico das contagens de estoque realizadas.</Alert>
             {historicoConferencias.map((grupo, index) => (
                 <Paper key={index} elevation={2} style={{ padding: '15px', borderLeft: grupo.temErro ? '6px solid red' : '6px solid green' }}>
                     <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                         <Typography variant="subtitle1" style={{ fontWeight: 'bold' }}>{grupo.data}</Typography>
                         <Chip label={grupo.temErro ? "DIVERGÊNCIA" : "OK"} color={grupo.temErro ? "error" : "success"} size="small" icon={grupo.temErro ? <CancelIcon /> : <CheckCircleIcon />} />
                     </Box>
                     <Divider />
                     <Stack spacing={1} mt={1}>
                         {grupo.itens.map(item => {
                             const difCheio = (item.fisico_cheio || 0) - (item.sistema_cheio || 0)
                             const difVazio = (item.fisico_vazio || 0) - (item.sistema_vazio || 0)
                             return (
                                 <Box key={item.id} display="flex" justifyContent="space-between" alignItems="center" style={{padding: '4px 0'}}>
                                     <Typography variant="body2" style={{fontWeight: '500'}}>{item.produto_nome}</Typography>
                                     {item.status === 'ok' ? ( <Typography variant="caption" color="textSecondary">Contagem batida</Typography> ) : ( <Box textAlign="right">{difCheio !== 0 && (<Typography variant="caption" display="block" style={{ color: 'red', fontWeight: 'bold' }}>Cheios: {difCheio > 0 ? `+${difCheio}` : difCheio}</Typography>)}{difVazio !== 0 && (<Typography variant="caption" display="block" style={{ color: '#ef6c00', fontWeight: 'bold' }}>Vazios: {difVazio > 0 ? `+${difVazio}` : difVazio}</Typography>)}</Box>)}
                                 </Box>
                             )
                         })}
                     </Stack>
                 </Paper>
             ))}
             {historicoConferencias.length === 0 && (<Typography align="center" color="textSecondary" mt={4}>Nenhuma conferência registrada.</Typography>)}
        </Stack>
      )}

      {/* === ABA 2: EXTRATO DIÁRIO (NOVA) === */}
      {tabAtual === 2 && (
        <Stack spacing={2}>
             <Paper elevation={0} style={{ padding: '15px', backgroundColor: '#e3f2fd' }}>
                <TextField 
                    type="date" 
                    label="Selecionar Dia" 
                    value={dataExtrato} 
                    onChange={(e) => setDataExtrato(e.target.value)} 
                    fullWidth 
                    InputLabelProps={{ shrink: true }}
                    style={{ backgroundColor: 'white', borderRadius: 4 }}
                />
             </Paper>

             {carregando ? <CircularProgress /> : (
                 <>
                    {/* RESUMO DO DIA */}
                    <Grid container spacing={2}>
                        <Grid item xs={4}>
                            <Paper style={{ padding: 10, textAlign: 'center' }}>
                                <Typography variant="caption">VENDAS</Typography>
                                <Typography variant="body1" fontWeight="bold">R$ {extratoDia.totalVendas.toFixed(2)}</Typography>
                            </Paper>
                        </Grid>
                        <Grid item xs={4}>
                            <Paper style={{ padding: 10, textAlign: 'center' }}>
                                <Typography variant="caption">RECEBIDO</Typography>
                                <Typography variant="body1" fontWeight="bold" color="success.main">R$ {extratoDia.totalRecebimentos.toFixed(2)}</Typography>
                            </Paper>
                        </Grid>
                        <Grid item xs={4}>
                            <Paper style={{ padding: 10, textAlign: 'center', backgroundColor: '#e8f5e9' }}>
                                <Typography variant="caption">TOTAL</Typography>
                                <Typography variant="body1" fontWeight="bold" color="green">R$ {(extratoDia.totalVendas + extratoDia.totalRecebimentos).toFixed(2)}</Typography>
                            </Paper>
                        </Grid>
                    </Grid>

                    {/* LISTA DE VENDAS */}
                    <Typography variant="subtitle2" style={{ marginTop: 20, color: '#666' }}>VENDAS DO DIA ({extratoDia.vendas.length})</Typography>
                    {extratoDia.vendas.length === 0 ? <Typography variant="caption">Nenhuma venda.</Typography> : (
                        <Paper>
                            <List dense>
                                {extratoDia.vendas.map(v => (
                                    <div key={v.id}>
                                        <ListItem>
                                            <ListItemText 
                                                primary={`${v.clientes?.nome} (${v.clientes?.tipo})`}
                                                secondary={v.itens_venda.map(i => `${i.quantidade}x ${i.produtos?.nome}`).join(', ')}
                                            />
                                            <Box textAlign="right">
                                                <Typography variant="body2" fontWeight="bold">R$ {v.total.toFixed(2)}</Typography>
                                                <Typography variant="caption" display="block">{v.forma_pagamento}</Typography>
                                            </Box>
                                        </ListItem>
                                        <Divider />
                                    </div>
                                ))}
                            </List>
                        </Paper>
                    )}

                    {/* LISTA DE RECEBIMENTOS */}
                    <Typography variant="subtitle2" style={{ marginTop: 20, color: '#666' }}>RECEBIMENTOS DE DÍVIDAS ({extratoDia.recebimentos.length})</Typography>
                    {extratoDia.recebimentos.length === 0 ? <Typography variant="caption">Nenhum recebimento de dívida.</Typography> : (
                        <Paper>
                            <List dense>
                                {extratoDia.recebimentos.map((r, i) => (
                                    <div key={i}>
                                        <ListItem>
                                            <ListItemText 
                                                primary={r.cliente}
                                                secondary={r.obs || 'Pagamento registrado'}
                                            />
                                            <Box textAlign="right">
                                                <Typography variant="body2" fontWeight="bold" color="success.main">+ R$ {r.valor.toFixed(2)}</Typography>
                                                <Box display="flex" alignItems="center" justifyContent="flex-end" gap={0.5}>
                                                    <AttachMoneyIcon fontSize="inherit" color="success" />
                                                    <Typography variant="caption">Recebido</Typography>
                                                </Box>
                                            </Box>
                                        </ListItem>
                                        <Divider />
                                    </div>
                                ))}
                            </List>
                        </Paper>
                    )}
                 </>
             )}
        </Stack>
      )}

      {/* MODAIS MANTIDOS */}
      <Dialog open={modalRetroativo} onClose={() => setModalRetroativo(false)} fullWidth>
        <DialogTitle>Lançar Venda Passada</DialogTitle>
        <DialogContent><Stack spacing={2} mt={1}><TextField type="date" label="Data" InputLabelProps={{ shrink: true }} value={dataRetroativa} onChange={e=>setDataRetroativa(e.target.value)} fullWidth /><TextField select label="Cliente" value={clienteRetroativo} onChange={e=>{setClienteRetroativo(e.target.value); setCarrinhoRetroativo({})}} fullWidth>{listaClientes.map(c=><MenuItem key={c.id} value={c.id}>{c.nome}</MenuItem>)}</TextField><Box border="1px solid #eee" p={1}>{listaProdutos.map(p => {const qtd = carrinhoRetroativo[p.id] || 0; return ( <Box key={p.id} display="flex" justifyContent="space-between" alignItems="center" mb={1}><Typography variant="body2">{p.nome}</Typography><Box display="flex" alignItems="center"><IconButton size="small" onClick={()=>removeItem(p)}><RemoveCircleIcon/></IconButton>{qtd}<IconButton size="small" onClick={()=>addItem(p)}><AddCircleIcon/></IconButton></Box></Box> )})}</Box><Typography align="right">Total: R$ {calcularTotalRetroativo().toFixed(2)}</Typography></Stack></DialogContent>
        <DialogActions><Button onClick={() => setModalRetroativo(false)}>Cancelar</Button><Button onClick={salvarVendaRetroativa} variant="contained" disabled={salvandoRetroativo}>Salvar</Button></DialogActions>
      </Dialog>
      
      <Dialog open={modalPrecos} onClose={() => setModalPrecos(false)} fullWidth>
        <DialogTitle>Tabela de Preços</DialogTitle>
        <DialogContent><Stack spacing={2} mt={1}>{listaProdutos.map(prod => ( <Box key={prod.id} display="flex" alignItems="center" gap={2}><Typography variant="body1" style={{width:100}}>{prod.nome}</Typography><TextField type="number" fullWidth value={novosPrecos[prod.id]} onChange={(e)=>handlePriceChangeInput(prod.id, e.target.value)} InputProps={{startAdornment:<InputAdornment position="start">R$</InputAdornment>}} /></Box> ))}</Stack></DialogContent>
        <DialogActions><Button onClick={()=>setModalPrecos(false)}>Cancelar</Button><Button onClick={salvarNovosPrecos} variant="contained" color="warning" disabled={salvandoPrecos}>Salvar</Button></DialogActions>
      </Dialog>
    </Container>
  )
}

export default Gerenciamento