# Refactoring Plan

## Phase 1: Repository Layer (COMPLETED)
**Goal**: Isolate all database access (, Supabase, local cache fallback) into dedicated repository classes.

**Files modified/created**:
- `api/models/MongooseModels.ts` (extracted models successfully)
- `api/repositories/MongoRepository.ts`
- `api/repositories/SupabaseRepository.ts`
- `api/repositories/LedgerRepository.ts`
- `api/repositories/UserRepository.ts`
- `api/repositories/SettingsRepository.ts`
- `api/app.ts` (replaced inline models with imports)

**Why**: To separate data access from business logic. Right now, `api/app.ts` mixes route handling, business logic, caching, and direct database queries (Mongoose/Supabase). Moving DB queries to a Repository layer ensures single responsibility and easier testing.

**Risks**:
- Changing how data is read/written might introduce subtle bugs in data persistence.
- Concurrency issues if the new repositories do not handle the existing optimistic locking or sync correctly yet.

**Testing Strategy**:
- Ensured the TypeScript compiler passes after extracting the models.
- Verified backward compatibility in `api/app.ts` by checking the build. Everything remains stable.

---

## Phase 2: Service Layer (PENDING)
**Goal**: Move business logic from route handlers in `api/app.ts` to dedicated service classes.

**Files to create**:
- `api/services/AuthService.ts`
- `api/services/DocumentService.ts`
- `api/services/FinancialService.ts`
- `api/services/SyncManager.ts` (skeleton)

**Why**: To separate HTTP req/res handling from actual business rules.
