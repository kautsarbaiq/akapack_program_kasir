# AKAPACK Project Handoff for Claude Code

Hello Claude! You are taking over the development of **AKAPACK**, a premium POS (Point of Sale) & Retail Management Platform. 

## 1. Project Context
- **Framework:** Next.js 15 (App Router) + TypeScript
- **Styling:** Tailwind CSS v4 + `shadcn/ui` (Dark navy + electric blue theme, `oklch` colors)
- **Backend (Planned):** Supabase (Auth, PostgreSQL, Storage) - *Not integrated yet, currently using mock data.*
- **State Management:** Zustand + TanStack Query (React Query)
- **Desktop App (Planned):** Tauri v2 (Windows)

## 2. Current Progress (June 2026)
We have successfully built the UI for about 80% of the frontend. **The app compiles successfully (16 pages)**. 
All data currently comes from `src/lib/mock-data.ts`.

**What is working (UI only, mock data):**
- Authentication pages (Login, Register, Forgot Password).
- Dashboard Layout (Sidebar, Header, Breadcrumbs).
- Dashboard Home (KPIs, Charts).
- Product & Inventory Pages (Catalog, Categories, Stock Movements, Opname UI).
- POS Web Interface (Cart, payment methods, quick cash input, change calculation).
- CRM & Reports (Transactions, Customer Database, Promotions, Employee Management, Settings).

## 3. Where We Left Off & Next Immediate Tasks
We were in the middle of building the form dialogs for CRUD operations before moving to the Supabase backend integration.

**Your immediate next tasks are:**
1. **Create `src/components/dashboard/category-form-dialog.tsx`**: A dialog to add/edit categories (fields: name, color picker, emoji icon selector, is_active).
2. **Create `src/components/dashboard/customer-form-dialog.tsx`**: A dialog to add/edit customers (name, phone, email, address, opening points).
3. **Create `src/components/dashboard/employee-form-dialog.tsx`**: A dialog to add/edit employees (name, role owner/manager/cashier, phone, email, pin, is_active).
4. **Create `src/components/dashboard/promotion-form-dialog.tsx`**: Dialog for promotions (type, value, voucher code generator, dates, max uses).
5. **Create POS Modals**: 
   - `src/components/pos/shift-modal.tsx` (Open/Close shift)
   - `src/components/pos/receipt-modal.tsx` (Checkout success receipt preview)
   - `src/components/pos/customer-selector.tsx` (Sheet to select a customer in the POS).

## 4. Codebase Rules & Guidelines
- **Strict TypeScript:** No `any`. Use the interfaces defined in `src/types/index.ts`.
- **UI Components:** Use existing `shadcn/ui` components from `src/components/ui`.
- **Icons:** Use `lucide-react`.
- **Mock Data:** If you need data before Supabase is connected, import from `src/lib/mock-data.ts`.
- **Utilities:** Use helpers from `src/lib/utils.ts` (e.g., `formatRupiah`, `formatDateTime`, `cn`).
- **Styling:** Maintain the premium "vibe coding" aesthetic. Use `oklch` colors defined in `globals.css`. Primary brand color is `oklch(0.55 0.22 264)` (electric blue), and background is deep navy. Use `sonner` for toast notifications.

## 5. Reference Documents
To see the full roadmap, architecture, and task list, please review:
- `CLAUDE_IMPLEMENTATION_PLAN.md` (The complete architecture and tech stack plan).
- `CLAUDE_TASK.md` (The detailed checklist of what is done and pending).
