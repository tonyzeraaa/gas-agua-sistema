import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// Importações do Material UI para funcionar o tema
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'

// --- DEFININDO O TEMA AQUI MESMO PARA EVITAR ERROS DE ARQUIVO ---
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2', // Azul padrão (ou mude para '#ff9800' para Laranja)
    },
    secondary: {
      main: '#dc004e', // Rosa/Vermelho
    },
    background: {
      default: '#f4f6f8', // Fundo cinza claro
    },
  },
  shape: {
    borderRadius: 8, // Bordas arredondadas
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      {/* CssBaseline chuta o estilo feio do navegador e aplica o fundo do tema */}
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)