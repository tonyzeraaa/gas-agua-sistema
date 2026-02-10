import { useState } from 'react'
import { Button, Container, Stack, Typography, Card, CardContent } from '@mui/material'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import InventoryIcon from '@mui/icons-material/Inventory'
import PeopleIcon from '@mui/icons-material/People'
import AssessmentIcon from '@mui/icons-material/Assessment' // <--- Ícone Novo

import Estoque from './Estoque'
import Venda from './Venda'
import Clientes from './Clientes'
import PerfilCliente from './PerfilCliente'
import Gerenciamento from './Gerenciamento' // <--- Importação Nova

function App() {
  const [telaAtual, setTelaAtual] = useState('menu')
  const [clienteSelecionado, setClienteSelecionado] = useState(null)

  const abrirPerfil = (cliente) => {
    setClienteSelecionado(cliente)
    setTelaAtual('perfil')
  }

  if (telaAtual === 'estoque') return <Estoque aoVoltar={() => setTelaAtual('menu')} />
  if (telaAtual === 'venda') return <Venda aoVoltar={() => setTelaAtual('menu')} />
  if (telaAtual === 'clientes') return <Clientes aoVoltar={() => setTelaAtual('menu')} aoClicarCliente={abrirPerfil} />
  if (telaAtual === 'perfil' && clienteSelecionado) return <PerfilCliente cliente={clienteSelecionado} aoVoltar={() => setTelaAtual('clientes')} />
  
  // <--- NOVA ROTA
  if (telaAtual === 'gerenciamento') return <Gerenciamento aoVoltar={() => setTelaAtual('menu')} />

  // === MENU PRINCIPAL ===
  return (
    <Container maxWidth="sm" style={{ marginTop: '2rem' }}>
      <Typography variant="h4" component="h1" gutterBottom align="center" style={{ fontWeight: 'bold', color: '#1976d2' }}>
        GÁS DO JU
      </Typography>
      <Typography variant="subtitle1" align="center" gutterBottom>
        Controle de Entregas
      </Typography>

      <Card style={{ marginTop: '20px', backgroundColor: '#fff' }}>
        <CardContent>
          <Stack spacing={2}>
            
            <Button variant="contained" size="large" startIcon={<LocalShippingIcon />} fullWidth onClick={() => setTelaAtual('venda')}>
              Nova Venda
            </Button>

            <Button variant="outlined" size="large" startIcon={<InventoryIcon />} fullWidth onClick={() => setTelaAtual('estoque')}>
              Estoque (Conferência)
            </Button>

            <Button variant="outlined" size="large" startIcon={<PeopleIcon />} fullWidth onClick={() => setTelaAtual('clientes')}>
              Clientes & Débitos
            </Button>
            
            {/* <--- NOVO BOTÃO DE GERENCIAMENTO */}
            <Button 
              variant="outlined" 
              size="large" 
              startIcon={<AssessmentIcon />} 
              fullWidth 
              color="secondary"
              onClick={() => setTelaAtual('gerenciamento')}
            >
              Gerenciamento & Métricas
            </Button>

          </Stack>
        </CardContent>
      </Card>
    </Container>
  )
}

export default App