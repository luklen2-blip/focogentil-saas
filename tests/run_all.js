const { execSync } = require('child_process');

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

console.log('====================================================');
console.log('🚀 EXECUTANDO TODAS AS SUÍTES DE TESTES (112 TESTES)');
console.log('====================================================\n');

for (const suite of testSuites) {
  console.log(`\n▶️ Executando ${suite}...`);
  try {
    const output = execSync(`node ${suite}`, { encoding: 'utf8' });
    console.log(output);
  } catch (err) {
    console.error(`❌ Falha em ${suite}:`, err.stdout || err.message);
    process.exit(1);
  }
}

console.log('\n====================================================');
console.log('🏆 TODOS OS 112 TESTES PASSARAM COM 100% DE SUCESSO!');
console.log('====================================================');
