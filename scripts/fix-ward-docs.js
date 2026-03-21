/**
 * fix-ward-docs.js
 * Actualiza los documentos de Ward.io con contenido en formato Tiptap/ProseMirror.
 */

const BASE   = 'http://localhost:4000'
const EMAIL  = 'admin@ailurus.dev'
const PASS   = 'Admin1234!'

let authToken = null

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(data)}`)
  return data
}

// ─── Helpers ProseMirror ─────────────────────────────────────────────────────

function doc(...nodes) {
  return { type: 'doc', content: nodes }
}

function h2(text) {
  return { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] }
}

function h3(text) {
  return { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text }] }
}

function p(text) {
  return { type: 'paragraph', content: [{ type: 'text', text }] }
}

function bold(text) {
  return { type: 'text', text, marks: [{ type: 'bold' }] }
}

function pMixed(...inlineNodes) {
  return { type: 'paragraph', content: inlineNodes }
}

function ul(...items) {
  return {
    type: 'bulletList',
    content: items.map((item) => ({
      type: 'listItem',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: item }] }],
    })),
  }
}

function hr() {
  return { type: 'horizontalRule' }
}

// ─── Contenidos ──────────────────────────────────────────────────────────────

const DOCS_CONTENT = {
  'Ward.io — Team Setup & Project Management': doc(
    h2('Ward.io — Team Setup & Project Management'),
    pMixed({ type: 'text', text: 'Para: ' }, bold('4 devs'), { type: 'text', text: ' (Frontend, Backend, Full-stack, DevOps) · Stack: React 18 + TS | Node/Express + TS | PostgreSQL RLS multi-tenant | GCS · Meta: MVP en staging para Q2 2026 (~22 semanas)' }),
    hr(),

    h2('🗺️ Estructura del Equipo'),
    ul(
      'Dev-FE → React SPA, UI components, forms, charts, routing multitenant',
      'Dev-BE → API REST, auth, servicios de negocio, aislamiento por tenant',
      'Dev-FS → Panel Super Admin, módulos de reportes, integraciones FE↔BE críticas',
      'Dev-OPS → PostgreSQL, CI/CD, monitoring, staging/prod',
    ),
    hr(),

    h2('⚠️ Consideraciones Críticas'),
    h3('1. Aislamiento de tenants es SAGRADO'),
    p('El aislamiento lo hace PostgreSQL RLS automáticamente, pero solo si se usa withTenant() en src/lib/prisma.ts. Cualquier query de negocio que no pase por withTenant() es un bug de seguridad crítico.'),

    h3('2. No hardcodear company_id'),
    p('Siempre viene de req.user.companyId (del JWT). Si ven un companyId = "algún-valor-fijo" en código que no sea de prueba, es un bug.'),

    h3('3. Los módulos son dinámicos'),
    p('Antes de mostrar una sección en FE o exponer un endpoint en BE, verificar que el módulo esté en active_modules del tenant. Para BE usar el middleware checkModuleAccess.'),

    h3('4. Toda nueva tabla de negocio necesita RLS'),
    p('Al crear una migración que agregue una tabla con datos por tenant, incluir ENABLE ROW LEVEL SECURITY y CREATE POLICY siguiendo el patrón de 20260309000001_enable_rls.'),

    h3('5. Code review obligatorio'),
    p('Para cualquier PR que toque: src/lib/prisma.ts, src/middleware/auth.ts, queries a la tabla companies, o cualquier nueva migración.'),
    hr(),

    h2('📊 Flujo de Reportes'),
    h3('Daily Standup (async en Slack)'),
    ul(
      '✅ Completé: [WARD-XXX] descripción breve',
      '🔧 Hoy trabajo en: [WARD-XXX] descripción breve',
      '🚧 Bloqueado en: [si aplica] descripción + qué necesito',
    ),
    h3('Reporte Semanal (viernes EOD)'),
    ul(
      'Tickets cerrados esta semana: lista de WARD-XXX',
      'Tickets en progreso: lista + % estimado de avance',
      'Riesgos o blockers',
      '¿Necesita decisión del PM? Sí/No',
    ),
    h3('Reglas'),
    ul(
      'Si un ticket se va a atrasar más de 2 días → avisa de inmediato en Slack.',
      'Si hay una decisión de arquitectura no cubierta en el PRD → abre un ticket tipo "DECISION".',
      'Bug de seguridad en aislamiento de tenants → avisa antes que cualquier otra cosa.',
    ),
  ),

  'Ward.io — Arquitectura Multi-tenant (RLS)': doc(
    h2('Ward.io — Arquitectura Multi-tenant (RLS)'),
    p('Single-database multi-tenant con Row Level Security. Todos los tenants comparten las mismas tablas en una sola BD PostgreSQL. El aislamiento lo hace Postgres automáticamente a nivel de fila.'),
    hr(),

    h2('🔑 El helper withTenant()'),
    p('Ubicación: src/lib/prisma.ts'),
    p('withTenant(companyId, fn) establece app.current_company_id como session variable. Las RLS policies de Postgres filtran automáticamente por ese valor en cada query.'),
    pMixed(bold('REGLA DE ORO: '), { type: 'text', text: 'Todo query de negocio va dentro de withTenant(). Solo las queries de companies/super_admin van sin él.' }),
    hr(),

    h2('🛡️ Middleware Auth'),
    p('Ubicación: src/middleware/auth.ts'),
    p('Valida el JWT y puebla req.user.companyId. Es el punto de entrada del contexto de tenant. Sin este middleware activo, RLS devuelve cero filas (fail-closed).'),
    hr(),

    h2('✅ Regla de nueva migración'),
    p('Toda tabla de negocio nueva debe incluir:'),
    ul(
      'ENABLE ROW LEVEL SECURITY',
      'CREATE POLICY usando el patrón de la migración 20260309000001_enable_rls',
    ),
    p('Ver migraciones 20260309000000 y 20260309000001 como referencia.'),
    hr(),

    h2('🔒 Middleware checkModuleAccess'),
    p('Verifica que el módulo requerido esté en active_modules del JWT antes de ejecutar cualquier handler de negocio.'),
    p('Los módulos son configurables por tenant desde el Panel Super Admin. No hardcodear el nav en FE ni exponer endpoints en BE sin verificar este campo.'),
    hr(),

    h2('🗄️ File Storage'),
    p('Google Cloud Storage con estructura:'),
    ul(
      '/tenant_{id}/invoices/',
      '/tenant_{id}/documents/',
    ),
  ),

  'Ward.io — Onboarding Devs': doc(
    h2('Ward.io — Onboarding Devs'),
    p('Guía de setup para los 4 devs del equipo. Completar en el Día 1.'),
    hr(),

    h2('📋 Todos los Devs — Día 1'),
    ul(
      'Leer este doc completo',
      'Leer el PRD Ward_APP-PRD.md (secciones: Resumen Ejecutivo, Arquitectura, Plan de Desarrollo)',
      'Acceso al repo (frontend / backend)',
      'Acceso al canal de Slack/Discord del proyecto',
      'Acceso a la app de tickets (ailurus)',
      'Setup local: clonar repos, instalar dependencias, copiar .env.example → .env, correr npm run db:migrate y npm run db:seed',
      'Revisar convenciones de código (ESLint + Prettier configs en el repo)',
      'Mandar mensaje en Slack: "Setup completo ✅" o bloqueos encontrados',
    ),
    hr(),

    h2('🎨 Dev-FE — Frontend'),
    h3('Stack'),
    ul('React 18 + TypeScript', 'Vite', 'TailwindCSS', 'Zustand', 'React Hook Form + Zod', 'Recharts', 'Axios', 'React Router v6'),
    h3('Conceptos clave'),
    ul(
      'La app es multitenant: el tenant se identifica por el companyId dentro del JWT al hacer login.',
      'Los módulos son dinámicos: el campo active_modules (array de strings) en el JWT determina qué secciones mostrar. No hardcodear el nav.',
      'Hay dos apps distintas: Panel Super Admin (/admin) y la app cliente del tenant.',
    ),
    h3('Setup'),
    ul(
      'Clonar repo ward-frontend',
      'Revisar estructura de carpetas (/inventory, /trips, /fleet, etc.)',
      'Revisar el design system / componentes base',
      'Correr la app en local y navegar las rutas existentes',
    ),
    hr(),

    h2('⚙️ Dev-BE — Backend'),
    h3('Stack'),
    ul('Node.js 20 + Express + TypeScript', 'Prisma', 'JWT (jsonwebtoken)', 'Zod', 'Resend (email)', 'Stripe'),
    h3('Conceptos clave'),
    ul(
      'Single-database multi-tenant con RLS: todos los tenants comparten las mismas tablas.',
      'El helper crítico es withTenant(companyId, fn) en src/lib/prisma.ts. Toda query de negocio debe ejecutarse dentro de este helper.',
      'El middleware de auth (src/middleware/auth.ts) valida el JWT y puebla req.user.companyId.',
    ),
    h3('Setup'),
    ul(
      'Clonar repo ward-backend',
      'Crear .env con credenciales de BD local (ver .env.example)',
      'Correr migraciones: npm run db:migrate',
      'Correr seed: npm run db:seed (crea una company de prueba)',
      'Leer src/lib/prisma.ts y src/middleware/auth.ts',
      'Probar POST /api/admin/companies para crear un nuevo tenant',
    ),
    hr(),

    h2('🔀 Dev-FS — Full-stack'),
    h3('Foco principal'),
    ul(
      'Panel Super Admin: opera sobre la tabla companies directamente (sin RLS de tenant). Endpoints en /api/admin/*, requieren rol super_admin.',
      'Reportes: queries complejas con aggregations dentro de withTenant() y exportación a Excel/PDF.',
      'Puente entre FE y BE: define contratos de API ambiguos.',
    ),
    h3('Setup'),
    ul(
      'Clonar ambos repos (ward-frontend y ward-backend)',
      'Setup completo de ambos entornos',
      'Revisar rutas existentes de admin: GET/POST /api/admin/companies, PATCH /api/admin/companies/:id',
      'Identificar dónde está el Panel Super Admin en FE o si hay que crearlo desde cero',
      'Revisar la sección RF-00 del PRD (Panel de Administración Maestro) — es tu principal entregable en Fase 0',
    ),
    hr(),

    h2('🛠️ Dev-OPS — DevOps/Infra'),
    h3('Stack'),
    ul('PostgreSQL 16+', 'Google Cloud Storage', 'GitHub Actions', 'Sentry'),
    h3('Conceptos clave'),
    ul(
      'Single-database + RLS: un solo Postgres. No hay una BD por cliente; el aislamiento es a nivel de fila.',
      'Cada nueva tabla de negocio debe incluir ENABLE ROW LEVEL SECURITY + CREATE POLICY.',
      'File storage en GCS: /tenant_{id}/invoices/, /tenant_{id}/documents/',
    ),
    h3('Setup'),
    ul(
      'Instalar PostgreSQL 16+ local y crear la base de datos',
      'Correr npm run db:migrate y verificar tablas y RLS policies',
      'Configurar acceso al bucket de Google Cloud Storage (dev)',
      'Documentar en el repo cómo crear un tenant de prueba desde cero',
      'Definir estructura de ambientes: dev / staging / prod',
    ),
  ),
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n📝 Ward.io — Fix doc content (Tiptap format)\n')

  // 1. Login
  const { token } = await api('POST', '/api/auth/login', { email: EMAIL, password: PASS })
  authToken = token
  console.log('✓ Autenticado')

  // 2. Buscar el proyecto Ward
  const { projects } = await api('GET', '/api/projects')
  const ward = projects.find((p) => p.name === 'Ward.io')
  if (!ward) throw new Error('Proyecto Ward.io no encontrado')
  console.log(`✓ Proyecto: ${ward.id}`)

  // 3. Obtener documentos
  const { documents } = await api('GET', `/api/documents?projectId=${ward.id}`)
  console.log(`✓ ${documents.length} documentos encontrados\n`)

  // 4. Actualizar cada doc
  for (const doc of documents) {
    const newContent = DOCS_CONTENT[doc.title]
    if (!newContent) {
      console.log(`⚠ Sin contenido definido para: ${doc.title}`)
      continue
    }
    await api('PUT', `/api/documents/${doc.id}`, { content: newContent })
    console.log(`✓ Actualizado: ${doc.title}`)
  }

  console.log('\n✅ Documentos actualizados con formato Tiptap\n')
}

main().catch((err) => {
  console.error('\n❌ Error:', err.message)
  process.exit(1)
})
