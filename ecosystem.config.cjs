module.exports = {
  apps: [
    {
      name: 'folio-dev',
      cwd: 'E:/experiments/daw',
      script: 'node',
      args: 'server.mjs',
      autorestart: true,
      watch: false,
      out_file: 'tmp/pm2-folio.out.log',
      error_file: 'tmp/pm2-folio.err.log',
      merge_logs: true,
    },
  ],
}
