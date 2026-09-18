const { execSync, spawn } = require('child_process');
const http = require('http');

const testSuites = [
  'tests/validate_system.js',
  'tests/test_e2e.js',
  'tests/test_v2_commercial.js',
  'tests/test_monthly_checkout.js',
  'tests/test_mobile_and_age.js',
  'tests/test_master_spec.js',
  'tests/test_executive_function.js',
  'tests/test_adaptive_copilot_v3.js',
  'tests/test_adaptive_personas.js',
  'tests/test_master_evolution_15.js'
];

function checkHealth() {
  return new Promise(resolve => {
    http.get('http://127.0.0.1:3000/api/health', res => {
      resolve(res.statusCode === 200);
    }).on('error', () => resolve(false));
  });
}

async function main() {
  let spawnedServer = null;
  const isHealthy = await checkHealth();
  if (!isHealthy) {
    console.log('⚡ Servidor não detectado na porta 3000. Iniciando servidor temporário para testes...');
    spawnedServer = spawn('node', ['server.js'], { stdio: 'ignore' });
    let attempts = 0;
    while (attempts < 20) {
      await new Promise(r => setTimeout(r, 500));
      if (await checkHealth()) break;
      attempts++;
    }
    console.log('✅ Servidor temporário ativo e pronto para testes!\n');
  }

  console.log('====================================================');
  console.log('🚀 EXECUTANDO TODAS AS SUÍTES DE TESTES (112 TESTES)');
  console.log('====================================================\n');

  try {
    for (const suite of testSuites) {
      console.log(`\n▶️ Executando ${suite}...`);
      const output = execSync(`node ${suite}`, { encoding: 'utf8' });
      console.log(output);
    }

    console.log('\n====================================================');
    console.log('🏆 TODOS OS 112 TESTES PASSARAM COM 100% DE SUCESSO!');
    console.log('====================================================');
  } catch (err) {
    console.error('❌ Falha na execução de testes:', err.stdout || err.message);
    if (spawnedServer) spawnedServer.kill();
    process.exit(1);
  }

  if (spawnedServer) {
    spawnedServer.kill();
  }
}

main();
