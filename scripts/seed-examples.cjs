const { loadConfig } = require('../backend/src/config/env');
const { openDatabase } = require('../backend/src/database/connection');
const { seedExamples } = require('../backend/src/database/seeds/examples');
const db = openDatabase(loadConfig().databasePath);
try {
  const result = seedExamples(db);
  console.log(
    `Exemplos adicionados: ${result.stock} peças/suprimentos e ${result.services} serviços. Os registros existentes foram preservados.`,
  );
} finally {
  db.close();
}
