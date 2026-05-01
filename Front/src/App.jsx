import { useEffect, useMemo, useState } from 'react'
import {
  Boxes,
  CheckCircle2,
  Edit3,
  Eye,
  EyeOff,
  LogOut,
  PackagePlus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5216'

const emptyForm = {
  id: null,
  name: '',
  description: '',
  category: '',
  price: '',
  stockQuantity: '',
  imageUrl: '',
  active: true,
}

function App() {
  const [session, setSession] = useState(() => {
    const saved = localStorage.getItem('barberstyle_admin_session')
    return saved ? JSON.parse(saved) : null
  })
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [products, setProducts] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [query, setQuery] = useState('')
  const [showInactive, setShowInactive] = useState(true)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const isEditing = Boolean(form.id)

  const filteredProducts = useMemo(() => {
    const term = query.trim().toLowerCase()

    return products.filter((product) => {
      const matchesStatus = showInactive || product.active
      const matchesTerm =
        !term ||
        product.name.toLowerCase().includes(term) ||
        product.category.toLowerCase().includes(term) ||
        product.description.toLowerCase().includes(term)

      return matchesStatus && matchesTerm
    })
  }, [products, query, showInactive])

  const stats = useMemo(() => {
    return products.reduce(
      (acc, product) => {
        acc.total += 1
        acc.active += product.active ? 1 : 0
        acc.stock += Number(product.stockQuantity ?? 0)
        acc.value += Number(product.price ?? 0) * Number(product.stockQuantity ?? 0)
        return acc
      },
      { total: 0, active: 0, stock: 0, value: 0 },
    )
  }, [products])

  useEffect(() => {
    if (!session?.token) {
      return undefined
    }

    let cancelled = false

    async function loadInitialProducts() {
      try {
        const response = await fetch(`${API_URL}/api/produtos/admin`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.token}`,
          },
        })
        const payload = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(payload?.message ?? 'Nao foi possivel carregar os produtos.')
        }

        if (!cancelled) {
          setProducts(payload)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message)
        }
      }
    }

    loadInitialProducts()

    return () => {
      cancelled = true
    }
  }, [session])

  async function request(path, options = {}) {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
        ...options.headers,
      },
    })

    if (response.status === 204) {
      return null
    }

    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      throw new Error(payload?.message ?? 'Nao foi possivel concluir a operacao.')
    }

    return payload
  }

  async function loadProducts() {
    setError('')
    setLoading(true)

    try {
      const data = await request('/api/produtos/admin')
      setProducts(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleLogin(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      const auth = await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginForm),
      })

      if (auth.role !== 'Admin') {
        throw new Error('Este usuario nao tem permissao de administrador.')
      }

      localStorage.setItem('barberstyle_admin_session', JSON.stringify(auth))
      setSession(auth)
      setMessage('Login realizado.')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    setSaving(true)

    const payload = {
      name: form.name,
      description: form.description,
      category: form.category,
      price: Number(form.price),
      stockQuantity: Number(form.stockQuantity),
      imageUrl: form.imageUrl,
      active: form.active,
    }

    try {
      const path = isEditing ? `/api/produtos/admin/${form.id}` : '/api/produtos/admin'
      const method = isEditing ? 'PUT' : 'POST'
      await request(path, {
        method,
        body: JSON.stringify(payload),
      })

      setForm(emptyForm)
      setMessage(isEditing ? 'Produto atualizado.' : 'Produto criado.')
      await loadProducts()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleProduct(product) {
    setError('')
    setMessage('')

    try {
      await request(`/api/produtos/admin/${product.id}/status?active=${!product.active}`, {
        method: 'PATCH',
      })
      setMessage(product.active ? 'Produto desativado.' : 'Produto ativado.')
      await loadProducts()
    } catch (err) {
      setError(err.message)
    }
  }

  async function deleteProduct(product) {
    setError('')
    setMessage('')

    try {
      await request(`/api/produtos/admin/${product.id}`, { method: 'DELETE' })
      setMessage('Produto removido do catalogo.')
      if (form.id === product.id) {
        setForm(emptyForm)
      }
      await loadProducts()
    } catch (err) {
      setError(err.message)
    }
  }

  function logout() {
    localStorage.removeItem('barberstyle_admin_session')
    setSession(null)
    setProducts([])
    setForm(emptyForm)
  }

  if (!session) {
    return (
      <main className="login-shell">
        <section className="login-panel">
          <div className="brand-mark">
            <ShieldCheck size={28} aria-hidden="true" />
          </div>
          <h1>BarberStyle Admin</h1>
          <p>Acesse com uma conta de administrador para gerenciar o catalogo.</p>

          <form className="login-form" onSubmit={handleLogin}>
            <label>
              Email
              <input
                type="email"
                value={loginForm.email}
                onChange={(event) => setLoginForm({ ...loginForm, email: event.target.value })}
                placeholder="admin@barberstyle.com"
                required
              />
            </label>

            <label>
              Senha
              <input
                type="password"
                value={loginForm.password}
                onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}
                placeholder="Sua senha"
                required
              />
            </label>

            {error && <div className="alert error">{error}</div>}

            <button className="primary-button" type="submit" disabled={loading}>
              <ShieldCheck size={18} aria-hidden="true" />
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </section>
      </main>
    )
  }

  return (
    <main className="admin-shell">
      <header className="topbar">
        <div>
          <span className="eyebrow">Painel administrativo</span>
          <h1>Produtos</h1>
        </div>
        <div className="topbar-actions">
          <button className="icon-button" type="button" onClick={loadProducts} title="Atualizar produtos">
            <RefreshCw size={18} aria-hidden="true" />
          </button>
          <button className="ghost-button" type="button" onClick={logout}>
            <LogOut size={18} aria-hidden="true" />
            Sair
          </button>
        </div>
      </header>

      <section className="stats-grid" aria-label="Resumo de produtos">
        <Metric icon={<Boxes size={20} />} label="Produtos" value={stats.total} />
        <Metric icon={<CheckCircle2 size={20} />} label="Ativos" value={stats.active} />
        <Metric icon={<PackagePlus size={20} />} label="Estoque" value={stats.stock} />
        <Metric icon={<Save size={20} />} label="Valor em estoque" value={formatMoney(stats.value)} />
      </section>

      {(message || error) && (
        <div className={`alert ${error ? 'error' : 'success'}`}>{error || message}</div>
      )}

      <section className="workspace">
        <div className="products-area">
          <div className="toolbar">
            <div className="search-box">
              <Search size={18} aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nome, categoria ou descricao"
              />
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(event) => setShowInactive(event.target.checked)}
              />
              Inativos
            </label>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Categoria</th>
                  <th>Preco</th>
                  <th>Estoque</th>
                  <th>Status</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div className="product-cell">
                        <div className="thumb">
                          {product.imageUrl ? <img src={product.imageUrl} alt="" /> : <Boxes size={18} />}
                        </div>
                        <div>
                          <strong>{product.name}</strong>
                          <span>{product.description || 'Sem descricao'}</span>
                        </div>
                      </div>
                    </td>
                    <td>{product.category || '-'}</td>
                    <td>{formatMoney(product.price)}</td>
                    <td>{product.stockQuantity}</td>
                    <td>
                      <span className={`status ${product.active ? 'active' : 'inactive'}`}>
                        {product.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-button" type="button" onClick={() => setForm(normalizeProduct(product))} title="Editar">
                          <Edit3 size={16} aria-hidden="true" />
                        </button>
                        <button className="icon-button" type="button" onClick={() => toggleProduct(product)} title={product.active ? 'Desativar' : 'Ativar'}>
                          {product.active ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                        </button>
                        <button className="icon-button danger" type="button" onClick={() => deleteProduct(product)} title="Remover">
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && filteredProducts.length === 0 && (
                  <tr>
                    <td className="empty-state" colSpan="6">
                      Nenhum produto encontrado.
                    </td>
                  </tr>
                )}
                {loading && (
                  <tr>
                    <td className="empty-state" colSpan="6">
                      Carregando produtos...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="editor-panel">
          <div className="panel-title">
            <div>
              <span className="eyebrow">{isEditing ? 'Edicao' : 'Novo item'}</span>
              <h2>{isEditing ? 'Editar produto' : 'Cadastrar produto'}</h2>
            </div>
            {isEditing && (
              <button className="icon-button" type="button" onClick={() => setForm(emptyForm)} title="Cancelar edicao">
                <X size={18} aria-hidden="true" />
              </button>
            )}
          </div>

          <form className="product-form" onSubmit={handleSubmit}>
            <label>
              Nome
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            </label>

            <label>
              Categoria
              <input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
            </label>

            <label>
              Descricao
              <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows="4" />
            </label>

            <div className="field-grid">
              <label>
                Preco
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(event) => setForm({ ...form, price: event.target.value })}
                  required
                />
              </label>

              <label>
                Estoque
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.stockQuantity}
                  onChange={(event) => setForm({ ...form, stockQuantity: event.target.value })}
                  required
                />
              </label>
            </div>

            <label>
              URL da imagem
              <input value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} />
            </label>

            <label className="toggle wide">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => setForm({ ...form, active: event.target.checked })}
              />
              Produto ativo
            </label>

            <button className="primary-button" type="submit" disabled={saving}>
              <Save size={18} aria-hidden="true" />
              {saving ? 'Salvando...' : isEditing ? 'Salvar alteracoes' : 'Criar produto'}
            </button>
          </form>
        </aside>
      </section>
    </main>
  )
}

function Metric({ icon, label, value }) {
  return (
    <div className="metric">
      <div className="metric-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function normalizeProduct(product) {
  return {
    id: product.id,
    name: product.name ?? '',
    description: product.description ?? '',
    category: product.category ?? '',
    price: product.price ?? '',
    stockQuantity: product.stockQuantity ?? '',
    imageUrl: product.imageUrl ?? '',
    active: product.active,
  }
}

function formatMoney(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value ?? 0))
}

export default App
