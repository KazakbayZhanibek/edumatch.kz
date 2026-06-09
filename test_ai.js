async function test() {
  const response = await fetch('http://localhost:3000/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Хочу поступить на психолога энт 67', lang: 'ru' })
  });
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

test().catch(console.error);