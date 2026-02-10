import { createTheme } from '@mui/material/styles'

const theme = createTheme({
  palette: {
    // Cor Primária (Botões principais, ícones de destaque)
    primary: {
      main: '#ff9800', // Laranja (Cor do Gás)
      contrastText: '#fff' // Texto branco dentro do botão laranja
    },
    // Cor Secundária (Botões de ação secundária, detalhes)
    secondary: {
      main: '#2196f3', // Azul (Cor da Água)
    },
    // Cor de Erro (Botões de excluir, alertas)
    error: {
      main: '#d32f2f',
    },
    // Cor de Fundo (Background geral)
    background: {
      default: '#f4f6f8',
      paper: '#ffffff',
    },
  },
  typography: {
    // Aqui você muda a fonte do site todo
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h5: {
      fontWeight: 'bold', // Deixa todos os títulos h5 em negrito
    }
  },
  shape: {
    borderRadius: 12, // Deixa os botões e cards mais arredondados (moderno)
  },
})

export default theme