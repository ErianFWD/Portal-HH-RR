import {Sequelize} from 'sequelize';
import {config} from './config.js';
import {defineModels} from './models.js';

if (new URL(config.DATABASE_URL).protocol !== 'mysql:') throw new Error('DATABASE_URL debe usar mysql://');
export const sequelize = new Sequelize(config.DATABASE_URL, {logging:false, timezone:'+00:00', pool:{max:10,min:0}});
export const models = defineModels(sequelize);

async function run(sql, params=[], transaction, connection=sequelize) {
  const [result, metadata] = await connection.query(sql, {bind:params, transaction});
  if (Array.isArray(result)) return {rows:result};
  // MySQL devuelve el id y el número de filas como valores para INSERT.
  return {rows:[], insertId:typeof result === 'number' ? result : result?.insertId, affectedRows:typeof metadata === 'number' ? metadata : metadata?.affectedRows};
}

// Interfaz de transición para las consultas existentes; cada transacción usa la
// misma conexión de Sequelize y se completa o revierte explícitamente.
export function databaseAdapter(connection,modelSet=defineModels(connection)) {return {
  models:modelSet,
  query: (sql, params) => run(sql, params,undefined,connection),
  async connect() {
    let transaction;
    return {
      async query(sql, params) {
        const command=sql.trim().toUpperCase();
        if (command === 'BEGIN') { if (transaction) throw Error('Transacción ya iniciada'); transaction=await connection.transaction(); return {rows:[]}; }
        if (command === 'COMMIT') { if (!transaction) throw Error('No hay transacción'); await transaction.commit(); transaction=null; return {rows:[]}; }
        if (command === 'ROLLBACK') { if (transaction && !transaction.finished) await transaction.rollback(); transaction=null; return {rows:[]}; }
        if (!transaction) throw Error('Se requiere una transacción para esta conexión');
        return run(sql, params, transaction,connection);
      },
      release() { if (transaction && !transaction.finished) throw Error('Hay una transacción sin finalizar'); },
    };
  },
  end: () => connection.close(),
};}
export const db=databaseAdapter(sequelize,models);
