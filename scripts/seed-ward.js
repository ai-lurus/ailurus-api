/**
 * seed-ward.js
 * Crea el proyecto Ward.io en ailurus con todos sus sprints, tickets y docs.
 * Uso: node scripts/seed-ward.js
 */

const BASE = 'http://localhost:4000'
const EMAIL = 'admin@ailurus.dev'
const PASS  = 'Admin1234!'

// ─── helpers ────────────────────────────────────────────────────────────────

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

function dateFromWeek(weekOffset, dayOfWeek = 1) {
  // Project starts Monday 2026-03-23
  const start = new Date('2026-03-23')
  const d = new Date(start)
  d.setDate(d.getDate() + (weekOffset - 1) * 7 + (dayOfWeek - 1))
  return d.toISOString().slice(0, 10)
}

function log(msg) { console.log(`  ${msg}`) }

// ─── data ────────────────────────────────────────────────────────────────────

const SPRINTS = [
  {
    name: 'Fase 0 — Infraestructura Multi-tenant',
    objective: 'Setup del entorno, RLS policies, Panel Super Admin base y CI/CD inicial.',
    startDate: dateFromWeek(1),
    endDate:   dateFromWeek(2, 7),
  },
  {
    name: 'Fase 1 — MVP Core',
    objective: 'Layout base, gestión de usuarios, módulo Inventario y Unidades.',
    startDate: dateFromWeek(3),
    endDate:   dateFromWeek(6, 7),
  },
  {
    name: 'Fase 2 — Operaciones',
    objective: 'Módulo Operadores, Rutas, motor de costos y gestión completa de Viajes.',
    startDate: dateFromWeek(7),
    endDate:   dateFromWeek(10, 7),
  },
  {
    name: 'Fase 3 — Reportes y Analytics',
    objective: 'Reportes de inventario, costos, viajes, rentabilidad y dashboard ejecutivo.',
    startDate: dateFromWeek(11),
    endDate:   dateFromWeek(14, 7),
  },
  {
    name: 'Fase 4 — Experiencia y Producción',
    objective: 'Notificaciones, white-labeling, seguridad, CI/CD completo y deploy a producción.',
    startDate: dateFromWeek(15),
    endDate:   dateFromWeek(22, 7),
  },
]

// sprintIndex: 0-based index into SPRINTS array
const TICKETS = [
  // ── Fase 0 Semana 1 ──────────────────────────────────────────────────────
  { id: 'WARD-001', sprintIndex: 0, title: '[WARD-001] Setup entorno local para todo el equipo', description: 'Configurar PostgreSQL, `.env`, migraciones y seed — documentarlo en el README.', storyPoints: 3 },
  { id: 'WARD-002', sprintIndex: 0, title: '[WARD-002] Auditoría de RLS policies existentes', description: 'Crear checklist: toda nueva migración de tabla de negocio debe incluir `ENABLE RLS` + `CREATE POLICY`.', storyPoints: 2 },
  { id: 'WARD-003', sprintIndex: 0, title: '[WARD-003] Auditar rutas y verificar uso de withTenant()', description: 'Revisar todas las rutas actuales y verificar que usan `withTenant()`; documentar el patrón en el repo.', storyPoints: 3 },
  { id: 'WARD-004', sprintIndex: 0, title: '[WARD-004] Middleware checkModuleAccess', description: 'Verifica que el módulo requerido esté en `active_modules` del tenant antes de ejecutar el handler.', storyPoints: 3 },
  { id: 'WARD-005', sprintIndex: 0, title: '[WARD-005] Completar POST /api/admin/companies', description: 'Agregar selección de módulos iniciales al crear el tenant.', storyPoints: 2 },
  { id: 'WARD-006', sprintIndex: 0, title: '[WARD-006] Estructura de ambientes dev/staging/prod', description: 'Definir estructura de ambientes y configurar variables de entorno por ambiente.', storyPoints: 2 },
  { id: 'WARD-007', sprintIndex: 0, title: '[WARD-007] CI/CD base con GitHub Actions', description: 'Setup lint + build en cada PR.', storyPoints: 2 },
  // ── Fase 0 Semana 2 ──────────────────────────────────────────────────────
  { id: 'WARD-008', sprintIndex: 0, title: '[WARD-008] Super Admin: autenticación y ruta protegida', description: 'Login separado para Super Admin, ruta protegida `/admin`.', storyPoints: 3 },
  { id: 'WARD-009', sprintIndex: 0, title: '[WARD-009] Super Admin: listado de tenants + CRUD básico', description: 'UI de listado de tenants con operaciones CRUD básicas.', storyPoints: 3 },
  { id: 'WARD-010', sprintIndex: 0, title: '[WARD-010] Super Admin: wizard de onboarding', description: '4 pasos: datos → plan → módulos → admin.', storyPoints: 5 },
  { id: 'WARD-011', sprintIndex: 0, title: '[WARD-011] Super Admin: toggle activar/desactivar módulos', description: 'UI para toggle de módulos por tenant (usa `PATCH /api/admin/companies/:id`).', storyPoints: 3 },
  { id: 'WARD-012', sprintIndex: 0, title: '[WARD-012] Auth: refresh tokens y rate limiting en login', description: 'Implementar refresh tokens y rate limiting en el endpoint de login.', storyPoints: 3 },
  { id: 'WARD-013', sprintIndex: 0, title: '[WARD-013] Dashboard de métricas globales', description: 'Total tenants, usuarios activos, MRR básico.', storyPoints: 3 },
  // ── Fase 1 ───────────────────────────────────────────────────────────────
  { id: 'WARD-014', sprintIndex: 1, title: '[WARD-014] Layout base de la app cliente', description: 'Nav dinámico según `active_modules`, routing multitenant.', storyPoints: 5 },
  { id: 'WARD-015', sprintIndex: 1, title: '[WARD-015] CRUD usuarios por tenant', description: 'Roles admin y operator con `withTenant()`.', storyPoints: 3 },
  { id: 'WARD-016', sprintIndex: 1, title: '[WARD-016] UI Gestión de Usuarios', description: 'Listado, crear, editar y asignar rol.', storyPoints: 3 },
  { id: 'WARD-017', sprintIndex: 1, title: '[WARD-017] Módulo Inventario: backend', description: 'Catálogo de materiales, entradas/salidas, stock actual (revisar lo existente).', storyPoints: 5 },
  { id: 'WARD-018', sprintIndex: 1, title: '[WARD-018] UI Inventario', description: 'Listado stock, registrar entrada/salida, alertas de stock mínimo.', storyPoints: 5 },
  { id: 'WARD-019', sprintIndex: 1, title: '[WARD-019] Módulo Unidades: backend', description: 'Registro de camiones (tipo, ejes, estado).', storyPoints: 3 },
  { id: 'WARD-020', sprintIndex: 1, title: '[WARD-020] UI Unidades', description: 'CRUD camiones, estados: disponible / en viaje / mantenimiento.', storyPoints: 3 },
  { id: 'WARD-021', sprintIndex: 1, title: '[WARD-021] Testing de aislamiento de datos entre tenants', description: 'Verificar que RLS bloquea cross-tenant. Crítico de seguridad.', storyPoints: 5 },
  { id: 'WARD-022', sprintIndex: 1, title: '[WARD-022] Deploy Fase 1 a staging', description: 'Primer deploy del MVP core a staging.', storyPoints: 2 },
  // ── Fase 2 ───────────────────────────────────────────────────────────────
  { id: 'WARD-023', sprintIndex: 2, title: '[WARD-023] Módulo Operadores: backend', description: 'Registro de conductores, disponibilidad y documentos.', storyPoints: 3 },
  { id: 'WARD-024', sprintIndex: 2, title: '[WARD-024] UI Operadores', description: 'CRUD, estado de disponibilidad, alerta de documentos por vencer.', storyPoints: 3 },
  { id: 'WARD-025', sprintIndex: 2, title: '[WARD-025] Sistema de Rutas: backend', description: 'Catálogo de rutas, parametrización de casetas por tipo/ejes.', storyPoints: 5 },
  { id: 'WARD-026', sprintIndex: 2, title: '[WARD-026] UI Rutas', description: 'Crear ruta, configurar tarifas de casetas por tipo de unidad.', storyPoints: 3 },
  { id: 'WARD-027', sprintIndex: 2, title: '[WARD-027] Motor de cálculo de costos', description: 'Casetas + combustible + seguro prorrateado + extras.', storyPoints: 8 },
  { id: 'WARD-028', sprintIndex: 2, title: '[WARD-028] Módulo Viajes: backend', description: 'Creación, asignación de ruta/unidad/operador, validación de disponibilidad.', storyPoints: 5 },
  { id: 'WARD-029', sprintIndex: 2, title: '[WARD-029] UI Viajes', description: 'Formulario nuevo viaje, desglose de costos en tiempo real, estados.', storyPoints: 5 },
  { id: 'WARD-030', sprintIndex: 2, title: '[WARD-030] Seguimiento de estados de viaje', description: 'Programado → En Curso → Completado/Cancelado.', storyPoints: 3 },
  { id: 'WARD-031', sprintIndex: 2, title: '[WARD-031] UI comparativa estimado vs real', description: 'Comparativa al cerrar un viaje.', storyPoints: 3 },
  { id: 'WARD-032', sprintIndex: 2, title: '[WARD-032] Deploy Fase 2 a staging', description: 'Deploy del módulo de operaciones completo a staging.', storyPoints: 2 },
  // ── Fase 3 ───────────────────────────────────────────────────────────────
  { id: 'WARD-033', sprintIndex: 3, title: '[WARD-033] Reporte de Inventario', description: 'Stock actual, movimientos, valor total. Exportar Excel/PDF.', storyPoints: 5 },
  { id: 'WARD-034', sprintIndex: 3, title: '[WARD-034] Reporte de Costos Operativos', description: 'Desglose por categoría, comparativa de períodos.', storyPoints: 5 },
  { id: 'WARD-035', sprintIndex: 3, title: '[WARD-035] Reporte de Viajes', description: 'Listado con filtros: ruta, operador, unidad, fechas.', storyPoints: 3 },
  { id: 'WARD-036', sprintIndex: 3, title: '[WARD-036] Análisis de Rentabilidad por Ruta', description: 'Tabla comparativa y gráfico de rentabilidad.', storyPoints: 5 },
  { id: 'WARD-037', sprintIndex: 3, title: '[WARD-037] Dashboard Ejecutivo', description: 'KPIs, estado de flota, top 5 rutas, alertas críticas.', storyPoints: 8 },
  { id: 'WARD-038', sprintIndex: 3, title: '[WARD-038] Análisis de desempeño de operadores', description: 'Viajes, km y puntualidad por operador.', storyPoints: 3 },
  { id: 'WARD-039', sprintIndex: 3, title: '[WARD-039] Optimización de índices en BD', description: 'Índices en BD para queries de reportes frecuentes.', storyPoints: 3 },
  { id: 'WARD-040', sprintIndex: 3, title: '[WARD-040] Testing de performance multi-tenant', description: 'Verificar que RLS no degrada tiempos con múltiples tenants concurrentes.', storyPoints: 5 },
  // ── Fase 4 ───────────────────────────────────────────────────────────────
  { id: 'WARD-041', sprintIndex: 4, title: '[WARD-041] Sistema de notificaciones en plataforma', description: 'Notificaciones de stock bajo, docs por vencer, mantenimientos.', storyPoints: 5 },
  { id: 'WARD-042', sprintIndex: 4, title: '[WARD-042] UI Notificaciones', description: 'Icono con contador, lista de notificaciones, marcar como leída.', storyPoints: 3 },
  { id: 'WARD-043', sprintIndex: 4, title: '[WARD-043] Onboarding tour para nuevos usuarios', description: 'Tour guiado para nuevos usuarios por tenant.', storyPoints: 3 },
  { id: 'WARD-044', sprintIndex: 4, title: '[WARD-044] White-labeling básico', description: 'Logo y colores configurables por tenant.', storyPoints: 5 },
  { id: 'WARD-045', sprintIndex: 4, title: '[WARD-045] Auditoría de seguridad multi-tenant', description: 'Pen testing y validación cross-tenant a nivel de RLS.', storyPoints: 8 },
  { id: 'WARD-046', sprintIndex: 4, title: '[WARD-046] Monitoreo: Sentry, alertas, dashboards', description: 'Configurar Sentry, alertas y dashboards de observabilidad.', storyPoints: 3 },
  { id: 'WARD-047', sprintIndex: 4, title: '[WARD-047] Plan de backups + disaster recovery', description: 'Scripts de backup y plan de disaster recovery.', storyPoints: 3 },
  { id: 'WARD-048', sprintIndex: 4, title: '[WARD-048] CI/CD pipeline completo', description: 'GitHub Actions: test → staging → prod.', storyPoints: 5 },
  { id: 'WARD-049', sprintIndex: 4, title: '[WARD-049] Endpoints de exportación Excel/PDF', description: 'Exportación xlsx y PDF para todos los reportes.', storyPoints: 5 },
  { id: 'WARD-050', sprintIndex: 4, title: '[WARD-050] Testing final, QA y bugs críticos', description: 'Testing final completo, QA y corrección de bugs críticos antes del deploy.', storyPoints: 8 },
  { id: 'WARD-051', sprintIndex: 4, title: '[WARD-051] Deploy a producción + migración pilotos', description: 'Deploy a producción y migración de datos de clientes piloto.', storyPoints: 5 },
]

const DOCS = [
  {
    title: 'Ward.io — Team Setup & Project Management',
    type: 'wiki',
    content: {
      sections: [
        { heading: 'Estructura del Equipo', body: 'Dev-FE: React SPA | Dev-BE: API REST + RLS | Dev-FS: Super Admin + Reportes | Dev-OPS: PostgreSQL + CI/CD' },
        { heading: 'Regla de Oro Multi-tenant', body: 'Todo query de negocio va dentro de withTenant(). Solo queries de companies/super_admin van sin él.' },
        { heading: 'Convenciones de Commits', body: 'feat(módulo): descripción / fix(módulo): descripción / chore: descripción' },
        { heading: 'Flujo de Reportes', body: 'Daily async en Slack antes de arrancar. Reporte semanal los viernes EOD.' },
        { heading: 'Consideraciones Críticas', body: '1. Aislamiento de tenants es SAGRADO. 2. No hardcodear company_id. 3. Módulos son dinámicos. 4. Toda tabla nueva necesita RLS. 5. Code review obligatorio en auth/prisma/companies/migraciones.' },
      ],
    },
  },
  {
    title: 'Ward.io — Arquitectura Multi-tenant (RLS)',
    type: 'specification',
    content: {
      sections: [
        { heading: 'Patrón withTenant()', body: 'El helper withTenant(companyId, fn) en src/lib/prisma.ts establece app.current_company_id como session variable. Postgres RLS filtra automáticamente por ese valor.' },
        { heading: 'Regla de nueva migración', body: 'Toda tabla de negocio debe incluir: ENABLE ROW LEVEL SECURITY + CREATE POLICY usando el patrón de 20260309000001_enable_rls.' },
        { heading: 'Middleware checkModuleAccess', body: 'Verifica que el módulo requerido esté en active_modules del JWT antes de ejecutar cualquier handler de negocio.' },
      ],
    },
  },
  {
    title: 'Ward.io — Onboarding Devs',
    type: 'wiki',
    content: {
      sections: [
        { heading: 'Día 1 — Todos los devs', body: '1. Leer este doc. 2. Leer PRD Ward_APP-PRD.md. 3. Acceso a repos, Slack, tickets. 4. Setup local: clonar, instalar deps, copiar .env.example → .env, npm run db:migrate, npm run db:seed. 5. Revisar ESLint + Prettier. 6. Mensaje en Slack: "Setup completo ✅".' },
        { heading: 'Dev-FE', body: 'Stack: React 18 + TS, Vite, TailwindCSS, Zustand, RHF + Zod, Recharts, Axios, Router v6. La app es multitenant: companyId viene en JWT. Nav dinámico por active_modules.' },
        { heading: 'Dev-BE', body: 'Stack: Node 20 + Express + TS, Prisma, JWT, Zod, Resend, Stripe. Leer src/lib/prisma.ts y src/middleware/auth.ts. Toda query de negocio dentro de withTenant().' },
        { heading: 'Dev-FS', body: 'Foco: Panel Super Admin (/api/admin/*) y módulo Reportes. Puente entre FE y BE para contratos de API.' },
        { heading: 'Dev-OPS', body: 'Stack: PostgreSQL 16+, GCS, GitHub Actions, Sentry. Verificar RLS policies en cada migración. Estructura dev/staging/prod.' },
      ],
    },
  },
]

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🚀 Ward.io — Seed ailurus\n')

  // 1. Login
  console.log('1. Autenticando...')
  const { token } = await api('POST', '/api/auth/login', { email: EMAIL, password: PASS })
  authToken = token
  log('✓ Token obtenido')

  // 2. Crear proyecto
  console.log('\n2. Creando proyecto Ward.io...')
  const { project } = await api('POST', '/api/projects', {
    name: 'Ward.io',
    description: 'Plataforma SaaS multitenant de gestión de flota, viajes y operaciones logísticas. MVP en staging para Q2 2026.',
    type: 'internal',
    deadline: '2026-08-23',
  })
  log(`✓ Proyecto creado: ${project.id}`)

  // 3. Crear sprints
  console.log('\n3. Creando sprints (5 fases)...')
  const sprintIds = []
  for (const s of SPRINTS) {
    const { sprint } = await api('POST', '/api/sprints', { projectId: project.id, ...s })
    sprintIds.push(sprint.id)
    log(`✓ ${sprint.name}`)
  }

  // 4. Crear tickets
  console.log('\n4. Creando tickets (51)...')
  let count = 0
  for (const t of TICKETS) {
    await api('POST', '/api/tasks', {
      projectId: project.id,
      sprintId: sprintIds[t.sprintIndex],
      title: t.title,
      description: t.description,
      category: 'engineering',
      storyPoints: t.storyPoints,
    })
    count++
    if (count % 10 === 0) log(`  ${count}/51 tickets creados...`)
  }
  log(`✓ ${count} tickets creados`)

  // 5. Crear documentos
  console.log('\n5. Creando documentos (3)...')
  for (const d of DOCS) {
    const { document } = await api('POST', '/api/documents', {
      projectId: project.id,
      title: d.title,
      type: d.type,
    })
    // Guardar contenido
    await api('PUT', `/api/documents/${document.id}`, { content: d.content })
    log(`✓ ${d.title}`)
  }

  console.log(`
✅ Ward.io creado exitosamente en ailurus
   Proyecto ID : ${project.id}
   Sprints     : ${sprintIds.length}
   Tickets     : ${count}
   Documentos  : ${DOCS.length}
`)
}

main().catch((err) => {
  console.error('\n❌ Error:', err.message)
  process.exit(1)
})
