export async function lookupCep(value, signal) {
  const cep = String(value || '').replace(/\D/g, '')
  if (!/^\d{8}$/.test(cep)) throw new Error('Informe um CEP com 8 dígitos.')
  const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal })
  if (!response.ok) throw new Error('Não foi possível consultar o CEP.')
  const data = await response.json()
  if (data.erro) throw new Error('CEP não encontrado.')
  return { postalCode: cep, street: data.logradouro || '', neighborhood: data.bairro || '', city: data.localidade || '', state: data.uf || '' }
}
