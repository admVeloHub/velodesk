/** ticketFormStyles v1.0.2 — gap reduzido entre título de seção e primeiro campo */

/** Fator 0,9 = mantém 90% do tamanho original (redução de 10%). */
export const SIZE_FACTOR = 0.9;

export const BASE = {
  inputFont: 0.875,
  labelFont: 0.75,
  titleFont: 1,
  sectionFont: 0.9375,
  menuItemFont: 0.875,
  bodyFont: 0.875,
  panelPadding: 16,
  fieldMarginTop: 8,
  fieldMarginBottom: 4,
  sectionTitleFieldGap: 2,
  inputPaddingY: 8.5,
  sectionGap: 12,
} as const;

export const scaled = (value: number, unit: 'rem' | 'px' = 'rem') =>
  `${+(value * SIZE_FACTOR).toFixed(4)}${unit}`;

export const compactFieldSx = {
  '& .MuiInputBase-root': { fontSize: scaled(BASE.inputFont) },
  '& .MuiInputBase-input': { py: scaled(BASE.inputPaddingY, 'px') },
  '& .MuiInputLabel-root': { fontSize: scaled(BASE.labelFont) },
  '& .MuiSelect-select': { py: scaled(BASE.inputPaddingY, 'px') },
};

export const sidebarSx = {
  height: '100%',
  overflow: 'auto',
  fontSize: scaled(BASE.bodyFont),
  '& .MuiFormControl-root, & .MuiTextField-root': {
    mt: scaled(BASE.fieldMarginTop, 'px'),
    mb: scaled(BASE.fieldMarginBottom, 'px'),
  },
  '& .MuiTypography + .MuiTextField-root, & .MuiTypography + .MuiFormControl-root, & .MuiTypography + .MuiBox-root':
    {
      mt: scaled(BASE.sectionTitleFieldGap, 'px'),
    },
  '& .MuiTypography + .MuiBox-root .MuiTextField-root:first-of-type': {
    mt: 0,
  },
};

/** @deprecated use sidebarSx */
export const panelSx = sidebarSx;

export const sectionDividerSx = {
  my: scaled(BASE.sectionGap, 'px'),
};

export const sectionTitleSx = {
  fontWeight: 700,
  fontSize: scaled(BASE.sectionFont),
  mb: 0,
};
