/** VelohubModulePlaceholderPage v1.0.0 — placeholder mock das abas VeloHub */
import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import { VELOHUB_MODULE_CONTENT, VelohubMockModule } from './velohubModules';

export default function VelohubModulePlaceholderPage({ module }: { module: VelohubMockModule }) {
  const content = VELOHUB_MODULE_CONTENT[module];

  return (
    <Box className="velohub-container" sx={{ m: 0 }}>
      <Stack spacing={2}>
        <Box>
          <Chip label="Ecossistema VeloHub" size="small" color="primary" sx={{ mb: 1.5 }} />
          <Typography variant="h5" sx={{ fontWeight: 700 }} gutterBottom>
            {content.title}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {content.subtitle}
          </Typography>
        </Box>

        <Paper className="velohub-card" sx={{ p: 2.5, cursor: 'default' }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Demonstração de aba
          </Typography>
          <Typography variant="body2">{content.hint}</Typography>
        </Paper>

        {content.highlights.length > 0 && (
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            {content.highlights.map((item) => (
              <Paper key={item} className="velohub-card" sx={{ p: 2, flex: 1, cursor: 'default' }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Em breve
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {item}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Conteúdo placeholder para validação de navegação entre abas do header principal.
                </Typography>
              </Paper>
            ))}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
