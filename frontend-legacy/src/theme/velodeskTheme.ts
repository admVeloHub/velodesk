/** velodeskTheme v1.2.0 — alinhado a FONTE DA VERDADE/LAYOUT_GUIDELINES.md */
import { createTheme, PaletteMode } from '@mui/material/styles';

export function createVelodeskTheme(mode: PaletteMode = 'light') {
  const isDark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: {
        main: '#1634FF',
        dark: '#000058',
        light: '#1694FF',
        contrastText: '#F3F7FC',
      },
      secondary: {
        main: '#006AB9',
        contrastText: '#F3F7FC',
      },
      success: {
        main: '#15A237',
        dark: '#128A2F',
        contrastText: '#F3F7FC',
      },
      warning: {
        main: '#FCC200',
        dark: '#E6B000',
        contrastText: '#000058',
      },
      error: {
        main: '#D32F2F',
        contrastText: '#F3F7FC',
      },
      background: {
        default: isDark ? '#272A30' : '#f0f4f8',
        paper: isDark ? '#323a42' : '#F3F7FC',
      },
      text: {
        primary: isDark ? '#F3F7FC' : '#272A30',
        secondary: isDark ? '#B0BEC5' : '#000058',
      },
      divider: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(22, 52, 255, 0.1)',
    },
    typography: {
      fontFamily: '"Poppins", "Roboto", "Helvetica", "Arial", sans-serif',
      h1: { fontWeight: 700, fontSize: '2rem' },
      h2: { fontWeight: 600, fontSize: '1.5rem' },
      h5: { fontWeight: 700, fontSize: '1.25rem' },
      h6: { fontWeight: 600, fontSize: '1.125rem' },
      body1: { fontWeight: 400, fontSize: '1rem', lineHeight: 1.6 },
      body2: { fontWeight: 400, fontSize: '0.875rem', lineHeight: 1.6 },
      button: { fontWeight: 600, textTransform: 'none' },
    },
    shape: {
      borderRadius: 12,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: isDark ? '#272A30' : '#f0f4f8',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: isDark ? '#323a42' : '#F3F7FC',
            borderRight: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(22, 52, 255, 0.1)'}`,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
          rounded: {
            borderRadius: 12,
          },
          elevation1: {
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(22, 52, 255, 0.1)'}`,
            transition: 'all 0.3s ease',
            '&:hover': {
              transform: 'translateY(-4px)',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.15)',
              borderColor: '#1694FF',
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            fontWeight: 600,
            textTransform: 'none',
            fontFamily: '"Poppins", "Roboto", "Helvetica", "Arial", sans-serif',
          },
          contained: {
            backgroundColor: '#1634FF',
            color: '#F3F7FC',
            '&:hover': {
              backgroundColor: '#000058',
            },
            '&.MuiButton-containedSecondary': {
              backgroundColor: '#006AB9',
              '&:hover': { backgroundColor: '#000058' },
            },
            '&.MuiButton-containedSuccess': {
              backgroundColor: '#15A237',
              '&:hover': { backgroundColor: '#128A2F' },
            },
            '&.MuiButton-containedWarning': {
              backgroundColor: '#FCC200',
              color: '#000058',
              '&:hover': { backgroundColor: '#E6B000' },
            },
          },
          outlined: {
            borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : '#000058',
            '&:hover': {
              borderColor: '#1694FF',
              backgroundColor: 'rgba(22, 148, 255, 0.08)',
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontFamily: '"Poppins", sans-serif',
            fontWeight: 500,
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            margin: '2px 8px',
            '&.active': {
              backgroundColor: isDark ? 'rgba(22, 148, 255, 0.15)' : 'rgba(22, 52, 255, 0.08)',
              borderLeft: '3px solid #1634FF',
            },
            '&:hover': {
              backgroundColor: isDark ? 'rgba(22, 148, 255, 0.1)' : 'rgba(22, 52, 255, 0.06)',
            },
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 8,
              backgroundColor: isDark ? '#323a42' : '#F3F7FC',
              '& fieldset': {
                borderColor: '#000058',
              },
              '&:hover fieldset': {
                borderColor: '#1694FF',
              },
              '&.Mui-focused fieldset': {
                borderColor: '#1694FF',
              },
            },
          },
        },
      },
      MuiSelect: {
        styleOverrides: {
          root: {
            fontFamily: '"Poppins", sans-serif',
          },
          select: {
            padding: '8px 14px',
            height: 'auto',
            display: 'flex',
            alignItems: 'center',
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            fontFamily: '"Poppins", sans-serif',
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          root: {
            borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(22, 52, 255, 0.1)'}`,
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            fontFamily: '"Poppins", sans-serif',
          },
        },
      },
    },
  });
}
