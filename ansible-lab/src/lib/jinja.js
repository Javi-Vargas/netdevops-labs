// Jinja-lite: enough templating + conditional evaluation for the labs.

export function lookup(path, vars) {
  const parts = String(path).split('.')
  let cur = vars
  for (const p of parts) {
    if (cur == null) return undefined
    cur = cur[p]
  }
  return cur
}

// Render {{ expr }} occurrences in a string. Supports a few filters.
export function render(str, vars) {
  if (typeof str !== 'string') return str
  return str.replace(/\{\{\s*(.*?)\s*\}\}/g, (_, expr) => {
    const val = evalExpr(expr, vars)
    return val == null ? '' : String(val)
  })
}

// Recursively render strings inside task argument structures.
export function renderDeep(value, vars) {
  if (typeof value === 'string') return render(value, vars)
  if (Array.isArray(value)) return value.map(v => renderDeep(v, vars))
  if (value && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) out[k] = renderDeep(v, vars)
    return out
  }
  return value
}

function evalExpr(expr, vars) {
  const [base, ...filters] = expr.split('|').map(s => s.trim())
  let val = resolveValue(base, vars)
  for (const f of filters) {
    const m = f.match(/^(\w+)(?:\((.*)\))?$/)
    if (!m) continue
    const name = m[1]
    const arg = m[2] !== undefined ? stripQuotes(m[2].trim()) : undefined
    if (name === 'default') val = (val === undefined || val === '') ? arg : val
    else if (name === 'upper') val = String(val ?? '').toUpperCase()
    else if (name === 'lower') val = String(val ?? '').toLowerCase()
    else if (name === 'int') val = parseInt(val, 10)
  }
  return val
}

function resolveValue(token, vars) {
  if (/^'.*'$/.test(token) || /^".*"$/.test(token)) return stripQuotes(token)
  if (/^-?\d+$/.test(token)) return Number(token)
  return lookup(token, vars)
}

function stripQuotes(s) {
  return s.replace(/^['"]|['"]$/g, '')
}

// Evaluate a `when:` expression to a boolean (supports and/or, comparisons, is defined).
export function evalWhen(expr, vars) {
  if (expr === undefined || expr === null) return true
  if (typeof expr === 'boolean') return expr
  if (Array.isArray(expr)) return expr.every(e => evalWhen(e, vars))

  const orParts = String(expr).split(/\s+or\s+/)
  if (orParts.length > 1) return orParts.some(p => evalWhen(p, vars))
  const andParts = String(expr).split(/\s+and\s+/)
  if (andParts.length > 1) return andParts.every(p => evalWhen(p, vars))

  return evalCondition(String(expr).trim(), vars)
}

function evalCondition(cond, vars) {
  let neg = false
  if (cond.startsWith('not ')) { neg = true; cond = cond.slice(4).trim() }

  let m = cond.match(/^(.*?)\s+is\s+(not\s+)?defined$/)
  if (m) {
    const defined = lookup(m[1].trim(), vars) !== undefined
    const res = m[2] ? !defined : defined
    return neg ? !res : res
  }

  m = cond.match(/^(.*?)\s*(==|!=|>=|<=|>|<)\s*(.*)$/)
  if (m) {
    const left = resolveValue(m[1].trim(), vars)
    const right = resolveValue(m[3].trim(), vars)
    const res = compare(left, m[2], right)
    return neg ? !res : res
  }

  const val = resolveValue(cond, vars)
  const truthy = !!val && val !== 'false' && val !== 0
  return neg ? !truthy : truthy
}

function compare(a, op, b) {
  switch (op) {
    case '==': return a == b // eslint-disable-line eqeqeq
    case '!=': return a != b // eslint-disable-line eqeqeq
    case '>': return Number(a) > Number(b)
    case '<': return Number(a) < Number(b)
    case '>=': return Number(a) >= Number(b)
    case '<=': return Number(a) <= Number(b)
    default: return false
  }
}
