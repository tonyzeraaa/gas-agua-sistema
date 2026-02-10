import { useState, useEffect } from 'react'
import { Container, Typography, Button, Paper, TextField, Stack, Box, Chip, CircularProgress, Alert, Grid, Divider } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SaveIcon from '@mui/icons-material/Save'
import { supabase } from './supabaseClient'

function Estoque({ aoVoltar }) {
  const [produtos, setProdutos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    buscarProdutos()
  }, [])

  async function buscarProdutos() {
    setCarregando(true)
    const { data, error } = await supabase.from('produtos').select('*').order('id')
    if (error) {
      alert('Erro ao buscar produtos!')
    } else {
      // Preenche os inputs com o valor atual para facilitar a conferência
      const produtosFormatados = data.map(p => ({
        ...p,
        contagemCheio: p.estoque_atual, // Já vem preenchido
        contagemVazio: p.estoque_vazio  // Já vem preenchido
      }))
      setProdutos(produtosFormatados)
    }
    setCarregando(false)
  }

  const atualizarInput = (id, campo, valor) => {
    const novos = produtos.map(p => p.id === id ? { ...p, [campo]: valor } : p)
    setProdutos(novos)
  }

  const salvarConferencia = async () => {
    setSalvando(true)
    
    try {
      const registrosHistorico = []

      for (const p of produtos) {
        // Valores Físicos (Digitados)
        const fisicoCheio = p.contagemCheio !== '' ? parseInt(p.contagemCheio) : p.estoque_atual
        const fisicoVazio = p.contagemVazio !== '' ? parseInt(p.contagemVazio) : p.estoque_vazio
        
        // Diferenças
        const difCheio = fisicoCheio - p.estoque_atual
        const difVazio = fisicoVazio - p.estoque_vazio
        const totalDiferenca = Math.abs(difCheio) + Math.abs(difVazio)

        // 1. Atualiza o Produto no Banco (Sempre, para manter o estoque real)
        if (difCheio !== 0 || difVazio !== 0) {
            await supabase.from('produtos')
                .update({ estoque_atual: fisicoCheio, estoque_vazio: fisicoVazio })
                .eq('id', p.id)
        }

        // 2. Prepara o registro para o Histórico (Extrato)
        registrosHistorico.push({
            produto_nome: p.nome,
            sistema_cheio: p.estoque_atual,
            fisico_cheio: fisicoCheio,
            sistema_vazio: p.estoque_vazio,
            fisico_vazio: fisicoVazio,
            diferenca: totalDiferenca,
            status: totalDiferenca === 0 ? 'ok' : 'divergente',
            data_conferencia: new Date().toISOString()
        })
      }

      // 3. Salva o Histórico em Lote
      if (registrosHistorico.length > 0) {
          const { error } = await supabase.from('historico_conferencias').insert(registrosHistorico)
          if (error) throw error
      }

      alert('Conferência registrada com sucesso!')
      aoVoltar() // Volta pro menu

    } catch (error) {
      console.error(error)
      alert('Erro ao salvar conferência.')
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) return <Container style={{marginTop:'2rem', textAlign:'center'}}><CircularProgress /></Container>

  return (
    <Container maxWidth="sm" style={{ marginTop: '1rem', paddingBottom: '100px' }}>
      <Button startIcon={<ArrowBackIcon />} onClick={aoVoltar} disabled={salvando} style={{ marginBottom: '1rem' }}>Voltar</Button>

      <Typography variant="h5" gutterBottom style={{ fontWeight: 'bold' }}>
        Conferência de Estoque
      </Typography>

      <Alert severity="info" style={{ marginBottom: '1rem' }}>
        Confirme os valores abaixo. Se houver diferença, altere o número e o sistema registrará a divergência.
      </Alert>

      <Stack spacing={2}>
        {produtos.map((p) => {
            const sistCheio = p.estoque_atual
            const fisCheio = p.contagemCheio !== '' ? parseInt(p.contagemCheio) : sistCheio
            const difCheio = fisCheio - sistCheio

            const sistVazio = p.estoque_vazio
            const fisVazio = p.contagemVazio !== '' ? parseInt(p.contagemVazio) : sistVazio
            const difVazio = fisVazio - sistVazio

            return (
                <Paper key={p.id} elevation={3} style={{ padding: '1rem', borderLeft: (difCheio !== 0 || difVazio !== 0) ? '5px solid red' : '5px solid green' }}>
                    <Typography variant="h6" style={{ fontWeight: 'bold', marginBottom: '10px' }}>{p.nome}</Typography>
                    
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={6}>
                            <Typography variant="caption" display="block">CHEIOS (Sistema: {sistCheio})</Typography>
                            <TextField 
                                type="number" size="small" fullWidth 
                                value={p.contagemCheio}
                                onChange={(e) => atualizarInput(p.id, 'contagemCheio', e.target.value)}
                                style={{ backgroundColor: difCheio !== 0 ? '#ffebee' : '#fff' }}
                            />
                        </Grid>

                        <Grid item xs={6}>
                            <Typography variant="caption" display="block">VAZIOS (Sistema: {sistVazio})</Typography>
                            <TextField 
                                type="number" size="small" fullWidth 
                                value={p.contagemVazio}
                                onChange={(e) => atualizarInput(p.id, 'contagemVazio', e.target.value)}
                                style={{ backgroundColor: difVazio !== 0 ? '#ffebee' : '#fff' }}
                            />
                        </Grid>
                    </Grid>
                </Paper>
            )
        })}
      </Stack>

      <Button 
        variant="contained" fullWidth size="large" startIcon={<SaveIcon />}
        onClick={salvarConferencia} disabled={salvando}
        style={{ marginTop: '2rem', height: '50px', backgroundColor: '#2e7d32' }}
      >
        {salvando ? 'Salvando...' : 'Finalizar Conferência'}
      </Button>
    </Container>
  )
}

export default Estoque