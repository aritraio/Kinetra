import { createApp } from './app';
import { readEnvironment } from './env';
export default createApp(readEnvironment(process.env));
