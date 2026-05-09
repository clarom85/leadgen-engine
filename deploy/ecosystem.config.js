// ============================================================
// PM2 ecosystem config per leadgen-engine
// Usage VPS: pm2 start deploy/ecosystem.config.js
// ============================================================

module.exports = {
  apps: [
    {
      name: 'leadgen-engine',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3010',
      cwd: '/opt/leadgen-engine',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: '3010'
      },
      error_file: '/var/log/pm2/leadgen-engine-error.log',
      out_file: '/var/log/pm2/leadgen-engine-out.log',
      merge_logs: true,
      time: true,
      kill_timeout: 5000
    }
  ]
};
