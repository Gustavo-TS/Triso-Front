# Integração com a API Triso

O frontend usa a API real por padrão em `http://localhost:5266`. Para alterar o endereço, configure:

```env
VITE_DATA_SOURCE=api
VITE_API_BASE_URL=http://localhost:5266
```

Todas as chamadas usam `credentials: include`, pois a autenticação administrativa é mantida por cookie HTTP-only. Em desenvolvimento, abra o frontend em `http://localhost:5173`, origem permitida pelo CORS padrão da API.

## Contratos utilizados

- Catálogo público: `GET /api/v1/catalog/products`, `/categories` e `/marketplaces`.
- Cliques: `POST /api/v1/events/marketplace-clicks` com `eventId`, `linkId` e `source`.
- Sessão: `POST /api/v1/auth/login`, `GET /api/v1/auth/session` e `POST /api/v1/auth/logout`.
- Produtos administrativos: `GET` e `POST /api/v1/admin/products`; `PATCH` e `DELETE /api/v1/admin/products/{id}`.
- Categorias administrativas: `GET` e `POST /api/v1/admin/categories`; `PATCH` e `DELETE /api/v1/admin/categories/{id}`. Criação e edição enviam `name` e `active`.
- Analytics: `GET /api/v1/admin/analytics/dashboard?from=YYYY-MM-DD&to=YYYY-MM-DD`.

O adaptador em `src/services/catalogService.js` converte `priceCents` para reais apenas na interface, relaciona categorias e marketplaces pelos respectivos IDs e envia o objeto completo no `PATCH`. O modo mock continua disponível definindo `VITE_DATA_SOURCE=mock`.
