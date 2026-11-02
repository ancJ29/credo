// The entry the build reads the app's stylesheet from: the font, Mantine's styles and every CSS
// module the screens draw with, reached through the words reader.
import '@fontsource-variable/noto-sans';
import '@mantine/core/styles.css';

export { readWords } from '../src/words';
