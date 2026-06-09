const { parseAdmissionQuery, getAdmissionPrediction } = require('./backend/ai-service.js');
const { getAdmissionPrediction: getPred } = require('./backend/admission-service.js');

async function test() {
  const params = parseAdmissionQuery('Хочу поступить на психолога энт 67');
  console.log('parseAdmissionQuery result:', JSON.stringify(params, null, 2));
  
  const prediction = getPred({
    ent: params.ent || 100,
    specialty: params.specialty,
    specialtyName: params.specialtyName,
    budget: params.budget || undefined,
    language: params.language || undefined,
    needDorm: params.needDorm || false,
    cityId: params.university_id ? undefined : undefined,
    attestat: params.attestat || undefined,
  });
  console.log('\ngetAdmissionPrediction input:', JSON.stringify(prediction.input, null, 2));
}

test().catch(console.error);