export async function ownBalance(db,user){const saldo=await db.models.SaldoVacaciones.findOne({attributes:['dias'],where:{colaborador_id:user.colaborador_id},raw:true});return saldo?.dias??null}
