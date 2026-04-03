import { Platform } from 'react-native';

const fontFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
});

export const typography = {
  // Headings
  h1: {
    fontFamily,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  h2: {
    fontFamily,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  h3: {
    fontFamily,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  h4: {
    fontFamily,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0,
  },

  // Body
  body: {
    fontFamily,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
  },
  bodySmall: {
    fontFamily,
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
  },

  // Labels & captions
  label: {
    fontFamily,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  caption: {
    fontFamily,
    fontSize: 12,
    fontWeight: '400',
  },

  // Buttons
  button: {
    fontFamily,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  buttonSmall: {
    fontFamily,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
};
