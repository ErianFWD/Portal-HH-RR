import {DataTypes} from 'sequelize';

// Los modelos apuntan a tablas existentes: nunca se ejecuta sync/alter automático.
export function defineModels(sequelize) {
  const options={timestamps:false,freezeTableName:true};
  const id={type:DataTypes.INTEGER,primaryKey:true,autoIncrement:true};
  const Colaborador=sequelize.define('colaboradores',{id,nombre:DataTypes.STRING,departamento:DataTypes.STRING,activo:DataTypes.BOOLEAN},options);
  const SaldoVacaciones=sequelize.define('saldos_vacaciones',{colaborador_id:{type:DataTypes.INTEGER,primaryKey:true},dias:DataTypes.DECIMAL(6,2)},options);
  const Usuario=sequelize.define('usuarios',{id,colaborador_id:DataTypes.INTEGER,email:DataTypes.STRING,password_hash:DataTypes.STRING,rol:DataTypes.STRING},options);
  const Sesion=sequelize.define('sesiones',{token_hash:{type:DataTypes.STRING(64),primaryKey:true},usuario_id:DataTypes.INTEGER,vence:DataTypes.DATE},options);
  const Solicitud=sequelize.define('solicitudes',{id,colaborador_id:DataTypes.INTEGER,tipo:DataTypes.STRING,estado:DataTypes.STRING,fecha:DataTypes.DATEONLY},options);
  const Incapacidad=sequelize.define('incapacidades',{id,colaborador_id:DataTypes.INTEGER,inicio:DataTypes.DATEONLY,fin:DataTypes.DATEONLY},options);
  const MovimientoPersonal=sequelize.define('movimientos_personal',{id,colaborador_id:DataTypes.INTEGER,tipo:DataTypes.STRING,fecha:DataTypes.DATEONLY},options);
  const ReporteDiario=sequelize.define('reportes_diarios',{fecha:{type:DataTypes.DATEONLY,primaryKey:true},datos:DataTypes.JSON,resumen:DataTypes.TEXT},options);
  Colaborador.hasOne(SaldoVacaciones,{foreignKey:'colaborador_id'});
  SaldoVacaciones.belongsTo(Colaborador,{foreignKey:'colaborador_id'});
  Colaborador.hasOne(Usuario,{foreignKey:'colaborador_id'});
  Usuario.belongsTo(Colaborador,{foreignKey:'colaborador_id'});
  return {Colaborador,SaldoVacaciones,Usuario,Sesion,Solicitud,Incapacidad,MovimientoPersonal,ReporteDiario};
}
