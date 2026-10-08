import { useEffect, useRef, useState } from "react";
import { APP_CONFIG } from "../../config/app.js";
import { ApiError } from "../../lib/apiClient.js";
import { accountService } from "../../services/accountService.js";
import { orderService } from "../../services/orderService.js";
import { lookupCep } from "../../services/cepService.js";
import { shippingService } from "../../services/shippingService.js";
import { addressService } from "../../services/addressService.js";
import { useCart } from "../cart/CartContext.jsx";
import { formatCurrency, productCents } from "../cart/cartValidation.js";
import { SiteHeader } from "../../components/SiteHeader.jsx";

const OrderStatus = {
  PendingPayment: 0,
  Paid: 1,
  InProduction: 2,
  ReadyToShip: 3,
  Shipped: 4,
  Delivered: 5,
  Cancelled: 6,
};
const orderStatus = {
  [OrderStatus.PendingPayment]: ["Aguardando pagamento", "warning"],
  [OrderStatus.Paid]: ["Pagamento confirmado", "success"],
  [OrderStatus.InProduction]: ["Em produção", "info"],
  [OrderStatus.ReadyToShip]: ["Pronto para envio", "info"],
  [OrderStatus.Shipped]: ["Enviado", "info"],
  [OrderStatus.Delivered]: ["Entregue", "success"],
  [OrderStatus.Cancelled]: ["Cancelado", "danger"],
};
const numericStatus = (status) => Number(status);
const paymentPending = (status) =>
  numericStatus(status) === OrderStatus.PendingPayment;
const navigate = (path) => {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
};
const isTrustedCheckoutUrl = (checkoutUrl) => {
  const url = new URL(checkoutUrl);
  if (url.protocol === "https:" && /(^|\.)infinitepay\.io$/i.test(url.hostname)) return true;

  if (!import.meta.env.DEV || url.searchParams.get("mock") !== "true") return false;
  const apiUrl = new URL(APP_CONFIG.apiBaseUrl);
  return ["http:", "https:"].includes(url.protocol) && url.hostname === apiUrl.hostname;
};
const message = (error) =>
  error?.status === 401
    ? "Entre na sua conta para continuar."
    : error?.message || "Não foi possível concluir a solicitação.";

function Layout({ children }) {
  return (
    <>
      <SiteHeader commerce />
      <main className="commerce-page">{children}</main>
    </>
  );
}
function Line({ line, editable }) {
  const { setQuantity, remove } = useCart();
  return (
    <article className="commerce-line">
      <div className="commerce-thumb">
        {line.product.imageUrl ? (
          <img src={line.product.imageUrl} alt="" />
        ) : null}
      </div>
      <div>
        <b>{line.product.name}</b>
        <small>{formatCurrency(productCents(line.product))} cada</small>
        {editable && (
          <div className="quantity">
            <button
              onClick={() => setQuantity(line.productId, line.quantity - 1)}
              aria-label="Diminuir quantidade"
            >
              −
            </button>
            <span>{line.quantity}</span>
            <button
              onClick={() => setQuantity(line.productId, line.quantity + 1)}
              aria-label="Aumentar quantidade"
            >
              +
            </button>
          </div>
        )}
      </div>
      <strong>
        {formatCurrency(productCents(line.product) * line.quantity)}
      </strong>
      {editable && (
        <button
          className="commerce-link danger"
          onClick={() => remove(line.productId)}
        >
          Remover
        </button>
      )}
    </article>
  );
}

export function CartPage() {
  const { lines, subtotalCents, clear } = useCart();
  const [clearConfirmation, setClearConfirmation] = useState(false);
  return (
    <Layout>
      <section className="commerce-card">
        <span className="commerce-kicker">COMPRA / CARRINHO</span>
        <div className="cart-heading">
          <h1>Seu carrinho</h1>
          {lines.length > 0 && (
            <button
              className="commerce-secondary cart-clear"
              onClick={() => setClearConfirmation(true)}
            >
              Limpar carrinho
            </button>
          )}
        </div>
        {lines.length ? (
          <>
            <div className="commerce-lines">
              {lines.map((line) => (
                <Line key={line.productId} line={line} editable />
              ))}
            </div>
            <div className="commerce-total">
              <span>
                Subtotal <small>Frete será informado pelo atendimento.</small>
              </span>
              <strong>{formatCurrency(subtotalCents)}</strong>
            </div>
            <div className="commerce-actions">
              <a className="commerce-secondary" href="/">
                ← Voltar para a loja
              </a>
              <a className="commerce-primary" href="/checkout">
                Continuar para checkout
              </a>
            </div>
          </>
        ) : (
          <div className="commerce-empty">
            <h2>Seu carrinho está vazio.</h2>
            <a className="commerce-primary" href="/">
              Ver produtos
            </a>
          </div>
        )}
      </section>
      {clearConfirmation && <div className="account-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setClearConfirmation(false)}><section className="cart-clear-modal" role="dialog" aria-modal="true" aria-labelledby="clear-cart-title"><span>ATENÇÃO</span><h2 id="clear-cart-title">Limpar carrinho?</h2><p>Todos os itens adicionados serão removidos. Esta ação pode ser desfeita adicionando-os novamente.</p><div><button className="commerce-secondary" type="button" onClick={() => setClearConfirmation(false)}>Cancelar</button><button className="commerce-danger" type="button" onClick={() => { clear(); setClearConfirmation(false); }}>Limpar carrinho</button></div></section></div>}
    </Layout>
  );
}

function AuthForm({ register = false }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmation: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const target = sessionStorage.getItem("triso_return_to") || "/minha-conta";
  const submit = async (event) => {
    event.preventDefault();
    if (register && form.password !== form.confirmation)
      return setError("As senhas não coincidem.");
    setBusy(true);
    setError("");
    try {
      const user = register
        ? await accountService.register(form)
        : await accountService.login(form);
      if (!user) throw new Error("Esta conta não é uma conta de cliente.");
      sessionStorage.removeItem("triso_return_to");
      navigate(target);
    } catch (err) {
      setError(message(err));
      setBusy(false);
    }
  };
  return (
    <Layout>
      <section className="commerce-auth">
        <span className="commerce-kicker">
          CONTA / {register ? "CADASTRO" : "ENTRAR"}
        </span>
        <h1>{register ? "Crie sua conta" : "Entre na sua conta"}</h1>
        <form onSubmit={submit}>
          {register && (
            <label>
              Nome
              <input
                required
                minLength="2"
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
              />
            </label>
          )}
          <label>
            E-mail
            <input
              required
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(event) =>
                setForm({ ...form, email: event.target.value })
              }
            />
          </label>
          <label>
            Senha
            <input
              required
              minLength="8"
              type="password"
              autoComplete={register ? "new-password" : "current-password"}
              value={form.password}
              onChange={(event) =>
                setForm({ ...form, password: event.target.value })
              }
            />
          </label>
          {register && (
            <label>
              Confirme a senha
              <input
                required
                minLength="8"
                type="password"
                autoComplete="new-password"
                value={form.confirmation}
                onChange={(event) =>
                  setForm({ ...form, confirmation: event.target.value })
                }
              />
            </label>
          )}
          {error && (
            <p className="commerce-error" role="alert">
              {error}
            </p>
          )}
          <button className="commerce-primary" disabled={busy}>
            {busy ? "Processando..." : register ? "Criar conta" : "Entrar"}
          </button>
        </form>
        <p>
          {register ? (
            <>
              Já possui conta? <a href="/entrar">Entrar</a>
            </>
          ) : (
            <>
              Ainda não tem conta? <a href="/cadastro">Criar conta</a>
            </>
          )}
        </p>
      </section>
    </Layout>
  );
}
export const LoginPage = () => <AuthForm />;
export const RegisterPage = () => <AuthForm register />;

const emptyAddress = {
  recipientName: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  postalCode: "",
};
function AddressPicker({ addresses, selectedId, onSelect }) {
  const [open, setOpen] = useState(false);
  const selected = addresses.find((address) => address.id === selectedId);
  const choose = (address) => {
    onSelect(address);
    setOpen(false);
  };
  return (
    <div className="address-picker">
      <span>Endereço salvo</span>
      <button
        type="button"
        className="address-picker-trigger"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <b>{selected?.label || "Usar endereço personalizado"}</b>
        <i>{open ? "⌃" : "⌄"}</i>
      </button>
      {open && (
        <div className="address-picker-menu">
          <button
            type="button"
            className={!selectedId ? "active" : ""}
            onClick={() => choose(null)}
          >
            <b>Usar endereço personalizado</b>
            <small>Não usa um endereço salvo</small>
          </button>
          {addresses.map((address) => (
            <button
              type="button"
              key={address.id}
              className={selectedId === address.id ? "active" : ""}
              onClick={() => choose(address)}
            >
              <b>
                {address.label}
                {address.isDefault && <em>Padrão</em>}
              </b>
              <small>
                {address.street}, {address.number} — {address.city}/
                {address.state}
              </small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
export function CheckoutPage() {
  const { lines, subtotalCents } = useCart();
  const [user, setUser] = useState(undefined);
  const [address, setAddress] = useState(emptyAddress);
  const [error, setError] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [quotes, setQuotes] = useState([]);
  const [shippingQuoteId, setShippingQuoteId] = useState("");
  const [quoting, setQuoting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [saveAddress, setSaveAddress] = useState(false);
  const [addressModal, setAddressModal] = useState(false);
  const orderRef = useRef(null);
  const quotedKeyRef = useRef("");
  const cep = address.postalCode.replace(/\D/g, "");
  const isPickup = shippingQuoteId === "pickup";
  const itemsKey = lines
    .map((line) => `${line.productId}:${line.quantity}`)
    .join("|");
  const addressReady =
    isPickup ||
    ([
      "recipientName",
      "postalCode",
      "street",
      "number",
      "neighborhood",
      "city",
      "state",
    ].every((key) => String(address[key] || "").trim()) &&
    /^\d{8}$/.test(cep) &&
    /^[a-z]{2}$/i.test(address.state.trim()));

  useEffect(() => {
    accountService
      .session()
      .then((currentUser) => {
        setUser(currentUser);
        if (currentUser?.name)
          setAddress((current) => ({
            ...current,
            recipientName: current.recipientName || currentUser.name,
          }));
      })
      .catch(() => setUser(null));
  }, []);
  useEffect(() => {
    if (user === null) {
      sessionStorage.setItem("triso_return_to", "/checkout");
      navigate("/entrar");
    }
  }, [user]);
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    addressService
      .list(controller.signal)
      .then((items) => {
        setSavedAddresses(items);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(message(err));
      });
    return () => controller.abort();
  }, [user]);
  useEffect(() => {
    if (cep.length !== 8) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setCepLoading(true);
      setError("");
      try {
        const found = await lookupCep(cep, controller.signal);
        setAddress((current) =>
          current.postalCode.replace(/\D/g, "") === cep
            ? {
                ...current,
                ...found,
                complement: current.complement,
                number: current.number,
                recipientName: current.recipientName,
              }
            : current,
        );
      } catch (err) {
        if (err.name !== "AbortError") setError(err.message);
      } finally {
        if (!controller.signal.aborted) setCepLoading(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [cep]);
  useEffect(() => {
    if (cep.length !== 8 || !itemsKey) {
      quotedKeyRef.current = "";
      setQuotes([]);
      setShippingQuoteId("");
      return;
    }
    const requestKey = `${cep}|${itemsKey}`;
    if (quotedKeyRef.current === requestKey) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setQuoting(true);
      setError("");
      setQuotes([]);
      setShippingQuoteId("");
      try {
        const result = await shippingService.quote(
          cep,
          lines,
          controller.signal,
        );
        quotedKeyRef.current = requestKey;
        setQuotes(result.quotes || []);
      } catch (err) {
        if (err.name !== "AbortError") setError(message(err));
      } finally {
        if (!controller.signal.aborted) setQuoting(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [cep, itemsKey, lines]);

  if (!lines.length) return <CartPage />;
  const pickupOption = {
    id: "pickup",
    carrier: "Retirada na loja",
    service: "Retirada no local",
    priceCents: 0,
  };
  const selectedQuote =
    shippingQuoteId === pickupOption.id
      ? pickupOption
      : quotes.find((quote) => quote.id === shippingQuoteId);
  const selectSavedAddress = (selected) => {
    setSelectedAddressId(selected.id);
    setSaveAddress(false);
    setAddress((current) => ({
      ...current,
      ...selected,
      complement: selected.complement || "",
      recipientName: selected.recipientName || current.recipientName,
    }));
  };
  const useManualAddress = () => {
    setSelectedAddressId("");
    setSaveAddress(false);
  };
  const changeAddress = (key, value) => {
    setSelectedAddressId("");
    if (key !== "postalCode") setSaveAddress(false);
    setAddress((current) => ({
      ...current,
      [key]: key === "state" ? value.toUpperCase() : value,
    }));
  };
  const submit = async (event) => {
    event.preventDefault();
    if (busy || !user) return;
    setBusy(true);
    setError("");
    const normalized = {
      ...address,
      postalCode: cep,
      state: address.state.trim().toUpperCase(),
    };
    if (!addressReady) {
      setBusy(false);
      return setError("Complete os dados obrigatórios de entrega.");
    }
    if (!shippingQuoteId) {
      setBusy(false);
      return setError("Selecione uma opção de entrega para continuar.");
    }
    try {
      if (saveAddress && !selectedAddressId) {
        const saved = await addressService.create({
          label: "Endereço do checkout",
          recipientName: normalized.recipientName,
          postalCode: normalized.postalCode,
          street: normalized.street,
          number: normalized.number,
          complement: normalized.complement || "",
          neighborhood: normalized.neighborhood,
          city: normalized.city,
          state: normalized.state,
          isDefault: savedAddresses.length === 0,
        });
        setSavedAddresses((current) => [...current, saved]);
        setSelectedAddressId(saved.id);
      }
      const order =
        orderRef.current ||
        (await orderService.create(
          lines.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
          })),
          normalized,
          shippingQuoteId,
        ));
      orderRef.current = order;
      const id = order.id;
      sessionStorage.setItem(
        "triso_current_order",
        JSON.stringify({
          id,
          items: lines.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
          })),
        }),
      );
      const checkout = await orderService.checkout(id);
      const url = new URL(checkout.checkoutUrl);
      if (!isTrustedCheckoutUrl(checkout.checkoutUrl))
        throw new Error("O endereço de pagamento retornado não é válido.");
      window.location.assign(url.toString());
    } catch (err) {
      setError(message(err));
      setBusy(false);
    }
  };
  return (
    <Layout>
      <section className="checkout-grid">
        <form className="commerce-card checkout-form" onSubmit={submit}>
          <span className="commerce-kicker">
            CHECKOUT / ENTREGA E PAGAMENTO
          </span>
          <h1>Entrega e pagamento</h1>
          <p>Informe o CEP para preencher o endereço e calcular o frete.</p>
          {!isPickup && <>
          <div className="commerce-fields">
            {[
              ["postalCode", "CEP"],
              ["street", "Rua"],
              ["number", "Número"],
              ["complement", "Complemento"],
              ["neighborhood", "Bairro"],
              ["city", "Cidade"],
              ["state", "Estado"],
            ].map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  required={key !== "complement"}
                  inputMode={key === "postalCode" ? "numeric" : undefined}
                  maxLength={
                    key === "state" ? 2 : key === "postalCode" ? 9 : undefined
                  }
                  value={address[key]}
                  onChange={(event) => changeAddress(key, event.target.value)}
                />
                {key === "postalCode" && cepLoading && (
                  <small>Consultando CEP...</small>
                )}
              </label>
            ))}
          </div>
          <div className="checkout-address-row">
            <AddressPicker
              addresses={savedAddresses}
              selectedId={selectedAddressId}
              onSelect={(selected) =>
                selected ? selectSavedAddress(selected) : useManualAddress()
              }
            />
            <button
              className="commerce-secondary checkout-manage-addresses"
              type="button"
              onClick={() => setAddressModal(true)}
            >
              Gerenciar endereços
            </button>
          </div>
          </>}
          <section className="shipping-quotes" aria-live="polite">
            <div className="shipping-quotes-heading">
              <span>ENTREGA</span>
              <h2>Escolha o frete</h2>
              <small>Escolha receber ou retirar seu pedido no local</small>
            </div>
            {quoting && (
              <div className="shipping-quote-loading">
                Calculando opções de entrega...
              </div>
            )}
            {!quoting &&
              quotes.map((quote) => (
                <label
                  key={quote.id}
                  className={`shipping-option ${shippingQuoteId === quote.id ? "selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="shippingQuote"
                    value={quote.id}
                    checked={shippingQuoteId === quote.id}
                    onChange={() => setShippingQuoteId(quote.id)}
                  />
                  <i className="shipping-option-radio" />
                  <span className="shipping-option-copy">
                    <b>
                      {quote.carrier} · {quote.service}
                    </b>
                    <small>Chega em até {quote.deliveryDays} dias úteis</small>
                  </span>
                  <span className="shipping-option-price">
                    <small>Frete</small>
                    <strong>{formatCurrency(quote.priceCents)}</strong>
                  </span>
                </label>
              ))}
            {!quoting && (
              <label
                className={`shipping-option ${shippingQuoteId === pickupOption.id ? "selected" : ""}`}
              >
                <input
                  type="radio"
                  name="shippingQuote"
                  value={pickupOption.id}
                  checked={shippingQuoteId === pickupOption.id}
                  onChange={() => setShippingQuoteId(pickupOption.id)}
                />
                <i className="shipping-option-radio" />
                <span className="shipping-option-copy">
                  <b>Retirar na loja</b>
                  <small>Sem frete · avisaremos quando estiver pronto</small>
                </span>
                <span className="shipping-option-price">
                  <small>Frete</small>
                  <strong>Grátis</strong>
                </span>
              </label>
            )}
            {!quoting && cep.length === 8 && !quotes.length && (
              <p className="shipping-quote-empty">
                Não há opções disponíveis para este CEP.
              </p>
            )}
          </section>
          {error && <p className="commerce-error">{error}</p>}
          <button className="commerce-primary" disabled={busy}>
            {busy ? "Criando pedido..." : "Ir para pagamento seguro"}
          </button>
        </form>
        <aside className="commerce-card checkout-summary">
          <span className="commerce-kicker">SEU PEDIDO</span>
          <h2>Resumo da compra</h2>
          <div className="checkout-summary-lines">
            {lines.map((line) => (
              <Line key={line.productId} line={line} />
            ))}
          </div>
          <div className="summary-breakdown">
            <div>
              <span>Produtos</span>
              <strong>{formatCurrency(subtotalCents)}</strong>
            </div>
            <div>
              <span>
                Entrega
                {selectedQuote && (
                  <small>
                    {selectedQuote.carrier} · {selectedQuote.service}
                  </small>
                )}
              </span>
              <strong>
                {selectedQuote
                  ? formatCurrency(selectedQuote.priceCents)
                  : "A calcular"}
              </strong>
            </div>
          </div>
          <div className="summary-total">
            <span>Total</span>
            <strong>
              {formatCurrency(subtotalCents + (selectedQuote?.priceCents || 0))}
            </strong>
          </div>
        </aside>
      </section>
      {addressModal && (
        <AddressManagerModal onClose={() => setAddressModal(false)} />
      )}
    </Layout>
  );
}

function StatusBadge({ status }) {
  const [label, tone] = orderStatus[numericStatus(status)] || [
    "Status desconhecido",
    "info",
  ];
  return <span className={`status-badge ${tone}`}>{label}</span>;
}
const orderSteps = [
  [OrderStatus.PendingPayment, "Pagamento", "Aguardando confirmação"],
  [OrderStatus.Paid, "Confirmado", "Pagamento aprovado"],
  [OrderStatus.InProduction, "Produção", "Pedido em produção"],
  [OrderStatus.ReadyToShip, "Envio", "Preparando postagem"],
  [OrderStatus.Shipped, "Enviado", "A caminho de você"],
  [OrderStatus.Delivered, "Entregue", "Entrega concluída"],
];
function OrderProgress({ status }) {
  const current = numericStatus(status);
  if (current === OrderStatus.Cancelled)
    return <section className="order-progress cancelled"><b>Pedido cancelado</b><small>Este pedido não seguirá para produção ou envio.</small></section>;
  return <section className="order-progress" aria-label="Andamento do pedido"><span>ANDAMENTO DO PEDIDO</span><ol>{orderSteps.map(([step, label, description]) => <li key={step} className={step < current ? "done" : step === current ? "current" : ""}><i>{step < current ? "✓" : step + 1}</i><div><b>{label}</b><small>{description}</small></div></li>)}</ol></section>;
}
function PendingPaymentNotice({ busy, onContinue }) {
  return (
    <section className="pending-payment-notice">
      <div>
        <span>PAGAMENTO PENDENTE</span>
        <h2>Seu pedido está reservado</h2>
        <p>Finalize o pagamento para iniciarmos a produção.</p>
      </div>
      <button className="commerce-primary" disabled={busy} onClick={onContinue}>
        {busy ? "Abrindo pagamento..." : "Continuar pagamento"}
      </button>
    </section>
  );
}
function ShippingDetails({ shipping, shippingCents }) {
  const trackingCode = shipping?.trackingCode?.trim();
  const trackingUrl = trackingCode ? `https://rastreamento.correios.com.br/app/index.php?objetos=${encodeURIComponent(trackingCode)}` : "";
  return (
    <section className="order-delivery-details">
      <div>
        <span>ENTREGA</span>
        <h2>
          {shipping
            ? `${shipping.carrier} · ${shipping.service}`
            : "Entrega selecionada"}
        </h2>
        {shipping && (
          <p>
            {shipping.deliveryDays
              ? `Previsão de até ${shipping.deliveryDays} dias úteis`
              : "Prazo informado pela transportadora"}
          </p>
        )}
        {trackingCode && <section className="tracking-details"><div><span>RASTREAMENTO</span><b>Entrega em trânsito</b><code>{trackingCode}</code></div><a href={trackingUrl} target="_blank" rel="noreferrer">Acompanhar <i>→</i></a></section>}
      </div>
      <strong>{formatCurrency(shipping?.priceCents ?? shippingCents)}</strong>
    </section>
  );
}
const emptySavedAddress = {
  label: "Casa",
  recipientName: "",
  postalCode: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  isDefault: false,
};
function AddressManagerModal({ onClose, onBack = onClose }) {
  const [addresses, setAddresses] = useState([]);
  const [form, setForm] = useState(emptySavedAddress);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const load = async () => {
    setLoading(true);
    try {
      setAddresses(await addressService.list());
    } catch (err) {
      setError(message(err));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  const set = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  const lookup = async () => {
    const postalCode = form.postalCode.replace(/\D/g, "");
    if (postalCode.length !== 8) return;
    setCepLoading(true);
    try {
      const found = await lookupCep(postalCode);
      setForm((current) => ({
        ...current,
        ...found,
        number: current.number,
        complement: current.complement,
        recipientName: current.recipientName,
        label: current.label,
        isDefault: current.isDefault,
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setCepLoading(false);
    }
  };
  const edit = (address) => {
    setEditing(address);
    setForm({
      ...emptySavedAddress,
      ...address,
      complement: address.complement || "",
    });
    setError("");
  };
  const reset = () => {
    setEditing(null);
    setForm(emptySavedAddress);
    setError("");
  };
  const submit = async (event) => {
    event.preventDefault();
    const payload = {
      ...form,
      postalCode: form.postalCode.replace(/\D/g, ""),
      state: form.state.trim().toUpperCase(),
      complement: form.complement || "",
    };
    setSaving(true);
    setError("");
    try {
      if (editing) await addressService.update(editing.id, payload);
      else await addressService.create(payload);
      await load();
      reset();
    } catch (err) {
      setError(message(err));
    } finally {
      setSaving(false);
    }
  };
  const remove = async (address) => {
    if (!window.confirm(`Excluir o endereço “${address.label}”?`)) return;
    setError("");
    try {
      await addressService.remove(address.id);
      await load();
      if (editing?.id === address.id) reset();
    } catch (err) {
      setError(message(err));
    }
  };
  return (
    <div
      className="account-modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="address-manager-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="address-manager-title"
      >
        <header>
          <div>
            <span className="commerce-kicker">MINHA CONTA / ENDEREÇOS</span>
            <h2 id="address-manager-title">Gerenciar endereços</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </header>
        <div className="address-manager-grid">
          <form onSubmit={submit}>
            <b>{editing ? "Editar endereço" : "Novo endereço"}</b>
            <div className="commerce-fields">
              <label>
                Identificação
                <input
                  value={form.label}
                  onChange={(event) => set("label", event.target.value)}
                  placeholder="Casa, trabalho..."
                  required
                />
              </label>
              <label>
                Nome de quem recebe
                <input
                  value={form.recipientName}
                  onChange={(event) => set("recipientName", event.target.value)}
                  required
                />
              </label>
              <label>
                CEP
                <input
                  inputMode="numeric"
                  maxLength="9"
                  value={form.postalCode}
                  onBlur={lookup}
                  onChange={(event) => set("postalCode", event.target.value)}
                  required
                />
                {cepLoading && <small>Consultando CEP...</small>}
              </label>
              <label>
                Rua
                <input
                  value={form.street}
                  onChange={(event) => set("street", event.target.value)}
                  required
                />
              </label>
              <label>
                Número
                <input
                  value={form.number}
                  onChange={(event) => set("number", event.target.value)}
                  required
                />
              </label>
              <label>
                Complemento
                <input
                  value={form.complement}
                  onChange={(event) => set("complement", event.target.value)}
                />
              </label>
              <label>
                Bairro
                <input
                  value={form.neighborhood}
                  onChange={(event) => set("neighborhood", event.target.value)}
                  required
                />
              </label>
              <label>
                Cidade
                <input
                  value={form.city}
                  onChange={(event) => set("city", event.target.value)}
                  required
                />
              </label>
              <label>
                UF
                <input
                  maxLength="2"
                  value={form.state}
                  onChange={(event) =>
                    set("state", event.target.value.toUpperCase())
                  }
                  required
                />
              </label>
            </div>
            <label className="address-default">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(event) => set("isDefault", event.target.checked)}
              />{" "}
              Definir como endereço padrão
            </label>
            {error && <p className="commerce-error">{error}</p>}
            <div className="address-form-actions">
              {editing && (
                <button
                  className="commerce-secondary"
                  type="button"
                  onClick={reset}
                >
                  Cancelar edição
                </button>
              )}
              <button className="commerce-primary" disabled={saving}>
                {saving
                  ? "Salvando..."
                  : editing
                    ? "Salvar alterações"
                    : "Adicionar endereço"}
              </button>
            </div>
          </form>
          <section className="saved-addresses">
            <b>Endereços salvos</b>
            {loading ? (
              <p>Carregando...</p>
            ) : addresses.length ? (
              addresses.map((address) => (
                <article key={address.id}>
                  <div>
                    <strong>
                      {address.label}
                      {address.isDefault && <em>Padrão</em>}
                    </strong>
                    <p>
                      {address.recipientName}
                      <br />
                      {address.street}, {address.number}
                      {address.complement ? `, ${address.complement}` : ""}
                      <br />
                      {address.neighborhood} — {address.city}/{address.state}
                      <br />
                      {address.postalCode}
                    </p>
                  </div>
                  <div>
                    <button type="button" onClick={() => edit(address)}>
                      Editar
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => remove(address)}
                    >
                      Excluir
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <p>Nenhum endereço salvo.</p>
            )}
          </section>
        </div>
        <footer>
          <button
            className="commerce-secondary"
            type="button"
            onClick={onBack}
          >
            Concluir
          </button>
        </footer>
      </section>
    </div>
  );
}
function AccountManagerModal({ profile, onSaved, onClose, onManageAddresses }) {
  const [form, setForm] = useState({
    name: profile?.name || "",
    email: profile?.email || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const saved = await accountService.updateProfile(form);
      onSaved(saved || { ...profile, ...form });
      onClose();
    } catch (err) {
      setError(message(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div
      className="account-modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="account-manager-modal"
        role="dialog"
        aria-modal="true"
      >
        <header>
          <div>
            <span className="commerce-kicker">MINHA CONTA</span>
            <h2>Gerenciar conta</h2>
          </div>
          <button type="button" onClick={onClose}>
            ×
          </button>
        </header>
        <form onSubmit={submit}>
          <div className="commerce-fields">
            <label>
              Nome
              <input
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                required
                minLength="2"
              />
            </label>
            <label>
              E-mail
              <input
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm({ ...form, email: event.target.value })
                }
                required
              />
            </label>
          </div>
          {error && <p className="commerce-error">{error}</p>}
          <section className="account-address-shortcut">
            <div>
              <span>ENDEREÇOS</span>
              <b>Locais de entrega salvos</b>
              <small>Adicione, edite ou escolha seu endereço padrão.</small>
            </div>
            <button
              className="commerce-secondary"
              type="button"
              onClick={onManageAddresses}
            >
              Gerenciar endereços
            </button>
          </section>
          <footer>
            <button
              className="commerce-secondary"
              type="button"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button className="commerce-primary" disabled={saving}>
              {saving ? "Salvando..." : "Salvar dados"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
export function ConfirmationPage({ orderId }) {
  const { clearPurchased } = useCart();
  const [order, setOrder] = useState(null);
  const [state, setState] = useState("loading");
  const load = async () => {
    try {
      const next = await orderService.get(orderId);
      setOrder(next);
      const status = numericStatus(next.status);
      const paid = status === OrderStatus.Paid;
      setState(
        paid
          ? "paid"
          : status === OrderStatus.Cancelled
            ? "cancelled"
            : "pending",
      );
      if (paid) {
        const current = JSON.parse(
          sessionStorage.getItem("triso_current_order") || "null",
        );
        if (current?.id === orderId) {
          clearPurchased(current.items);
          sessionStorage.removeItem("triso_current_order");
        }
      }
      return status;
    } catch (error) {
      setState(error.status === 404 ? "missing" : "error");
      return false;
    }
  };
  const refreshPayment = async () => {
    const status = await load();
    if (status === OrderStatus.Paid || status === OrderStatus.Cancelled)
      navigate(`/minha-conta/pedidos/${orderId}`);
  };
  useEffect(() => {
    let active = true;
    let attempts = 0;
    let timer;
    const poll = async () => {
      const status = await load();
      if (!active || status === OrderStatus.Paid || status === OrderStatus.Cancelled)
        return;
      attempts += 1;
      if (attempts >= 20) {
        setState((current) => (current === "pending" ? "timeout" : current));
        return;
      }
      timer = window.setTimeout(poll, 3000);
    };
    poll();
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [orderId]);
  return (
    <Layout>
      <section className="commerce-card confirmation">
        <span className="commerce-kicker">PEDIDO / CONFIRMAÇÃO</span>
        {state === "loading" && (
          <>
            <h1>Confirmando seu pagamento...</h1>
            <p>
              A confirmação é feita diretamente pelo nosso sistema de pedidos.
            </p>
          </>
        )}
        {state === "paid" && (
          <>
            <h1>Pagamento confirmado!</h1>
            <StatusBadge status={order.status} />
            <p>
              Pedido {order.orderNumber} recebido. Vamos iniciar a produção em
              breve.
            </p>
            <a
              className="commerce-primary"
              href={`/minha-conta/pedidos/${orderId}`}
            >
              Ver pedido
            </a>
          </>
        )}
        {state === "cancelled" && (
          <>
            <h1>Pedido cancelado</h1>
            <p>Este pagamento não foi confirmado. Você pode acompanhar seus pedidos ou iniciar uma nova compra.</p>
            <a className="commerce-primary" href="/minha-conta">Ver meus pedidos</a>
          </>
        )}
        {["pending", "timeout"].includes(state) && (
          <>
            <h1>Aguardando confirmação</h1>
            <p>
              {state === "timeout"
                ? "Ainda estamos aguardando a confirmação. Você pode acompanhar o status em Meus pedidos."
                : "Aguardando confirmação do pagamento."}
            </p>
            {order && <StatusBadge status={order.status} />}
            <button className="commerce-primary" onClick={refreshPayment}>
              Atualizar pagamento
            </button>
          </>
        )}
        {state === "missing" && (
          <>
            <h1>Pedido não encontrado</h1>
            <a href="/minha-conta/pedidos">Ver meus pedidos</a>
          </>
        )}
        {state === "error" && (
          <>
            <h1>Não foi possível consultar o pedido</h1>
            <button className="commerce-primary" onClick={load}>
              Tentar novamente
            </button>
          </>
        )}
      </section>
    </Layout>
  );
}

export function AccountPage({ detailId }) {
  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [payingId, setPayingId] = useState("");
  const [addressModal, setAddressModal] = useState(false);
  const [addressReturnTo, setAddressReturnTo] = useState("");
  const [accountModal, setAccountModal] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      accountService.profile(controller.signal),
      orderService.list(controller.signal),
    ])
      .then(([nextProfile, nextOrders]) => {
        setProfile(nextProfile);
        setOrders(nextOrders);
        if (detailId)
          return orderService.get(detailId, controller.signal).then(setDetail);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(message(err));
      });
    return () => controller.abort();
  }, [detailId]);
  useEffect(() => {
    if (!detailId) return undefined;
    const refreshDetail = () => {
      orderService.get(detailId).then(setDetail).catch(() => {});
    };
    const timer = window.setInterval(refreshDetail, 5000);
    return () => window.clearInterval(timer);
  }, [detailId]);
  const resumeCheckout = async (id) => {
    setPayingId(id);
    setError("");
    try {
      const checkout = await orderService.checkout(id);
      const url = new URL(checkout.checkoutUrl);
      if (!isTrustedCheckoutUrl(checkout.checkoutUrl))
        throw new Error("URL de pagamento inválida.");
      window.location.assign(url.toString());
    } catch (err) {
      setError(message(err));
      setPayingId("");
    }
  };
  if (error && !profile)
    return (
      <Layout>
        <section className="commerce-card">
          <p className="commerce-error">{error}</p>
          <a href="/entrar">Entrar novamente</a>
        </section>
      </Layout>
    );
  return (
    <>
      <Layout>
        <section className="commerce-card account">
          <span className="commerce-kicker">MINHA CONTA</span>
          <h1>
            {detail
              ? `Pedido ${detail.orderNumber}`
              : profile
                ? `Olá, ${profile.name}`
                : "Carregando conta..."}
          </h1>
          {error && <p className="commerce-error">{error}</p>}
          {detail ? (
            <>
              {paymentPending(detail.status) ? (
                <PendingPaymentNotice
                  busy={payingId === detail.id}
                  onContinue={() => resumeCheckout(detail.id)}
                />
              ) : (
                <StatusBadge status={detail.status} />
              )}
              <OrderProgress status={detail.status} />
              <div className="commerce-lines">
                {detail.items.map((item) => (
                  <article
                    className="commerce-line order-detail-line"
                    key={item.productId}
                  >
                    <div>
                      <b>{item.productName}</b>
                      <small>
                        {item.quantity} × {formatCurrency(item.unitPriceCents)}
                      </small>
                    </div>
                    <strong>{formatCurrency(item.totalCents)}</strong>
                  </article>
                ))}
              </div>
              <ShippingDetails
                shipping={detail.shipping}
                shippingCents={detail.shippingCents}
              />
              <div className="order-total-line">
                <span>Total do pedido</span>
                <strong>{formatCurrency(detail.totalCents)}</strong>
              </div>
              <div className="account-navigation">
                <a className="commerce-secondary" href="/minha-conta">
                  ← Voltar aos pedidos
                </a>
              </div>
            </>
          ) : (
            <>
              <div className="account-tools">
                <button
                  className="commerce-secondary"
                  type="button"
                  onClick={() => setAccountModal(true)}
                >
                  Gerenciar conta
                </button>
              </div>
              <h2>Meus pedidos</h2>
              {orders?.length ? (
                <div className="commerce-orders">
                  {orders.map((order) => (
                    <article className="commerce-order" key={order.id}>
                      <a href={`/minha-conta/pedidos/${order.id}`}>
                        <span>
                          <b>{order.orderNumber}</b>
                          <small>
                            {new Date(order.createdAt).toLocaleDateString(
                              "pt-BR",
                            )}
                          </small>
                          <small>
                            {order.shipping
                              ? `${order.shipping.carrier} · ${order.shipping.service} · ${formatCurrency(order.shipping.priceCents)}`
                              : `Entrega: ${formatCurrency(order.shippingCents)}`}
                          </small>
                        </span>
                        <StatusBadge status={order.status} />
                        <strong>{formatCurrency(order.totalCents)}</strong>
                      </a>
                    </article>
                  ))}
                </div>
              ) : (
                orders && <section className="account-orders-empty"><span>SEUS PEDIDOS</span><h3>Ainda não há pedidos por aqui</h3><p>Quando você finalizar uma compra, acompanharemos por aqui cada etapa — do pagamento à entrega.</p><a className="commerce-primary" href="/#loja">Explorar produtos <i>→</i></a></section>
              )}
              {orders?.length > 0 && <div className="account-navigation"><a className="commerce-secondary" href="/">← Voltar para a loja</a></div>}
            </>
          )}
        </section>
      </Layout>
      {addressModal && (
        <AddressManagerModal
          onClose={() => {
            setAddressModal(false);
            setAddressReturnTo("");
          }}
          onBack={() => {
            setAddressModal(false);
            if (addressReturnTo === "account") setAccountModal(true);
            setAddressReturnTo("");
          }}
        />
      )}
      {accountModal && (
        <AccountManagerModal
          profile={profile}
          onSaved={setProfile}
          onClose={() => setAccountModal(false)}
          onManageAddresses={() => {
            setAccountModal(false);
            setAddressReturnTo("account");
            setAddressModal(true);
          }}
        />
      )}
    </>
  );
}

export function PaymentReturnPage() {
  const saved = JSON.parse(
    sessionStorage.getItem("triso_current_order") || "null",
  );
  const orderId =
    new URLSearchParams(window.location.search).get("order_nsu") || saved?.id;
  return orderId ? (
    <ConfirmationPage orderId={orderId} />
  ) : (
    <Layout>
      <section className="commerce-card">
        <h1>Não foi possível identificar o pedido.</h1>
        <a href="/minha-conta/pedidos">Ver meus pedidos</a>
      </section>
    </Layout>
  );
}
