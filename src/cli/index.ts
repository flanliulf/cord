import { Command } from 'commander';

const program = new Command();

program
  .name('cord')
  .description('Document relationship graph engine for AI-assisted development')
  .version('0.1.0');

program.parse(process.argv);
