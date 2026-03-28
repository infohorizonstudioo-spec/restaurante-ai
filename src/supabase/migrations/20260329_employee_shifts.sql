-- Employees table
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'camarero',
  phone TEXT,
  email TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_emp_tenant ON employees(tenant_id) WHERE active = TRUE;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS emp_tenant ON employees;
CREATE POLICY emp_tenant ON employees USING (tenant_id IN (SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid()));

-- Shifts table
CREATE TABLE IF NOT EXISTS employee_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  shift_type TEXT NOT NULL CHECK (shift_type IN ('morning','afternoon','night','split','custom')),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  break_minutes INT DEFAULT 0,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled','confirmed','started','ended','absent','late')),
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_shift_tenant ON employee_shifts(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_shift_emp ON employee_shifts(employee_id, date);
ALTER TABLE employee_shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shift_tenant ON employee_shifts;
CREATE POLICY shift_tenant ON employee_shifts USING (tenant_id IN (SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid()));

-- Schedule templates (for rotating schedules)
CREATE TABLE IF NOT EXISTS schedule_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template_type TEXT DEFAULT 'static' CHECK (template_type IN ('static','rotating')),
  rotation_weeks INT DEFAULT 1,
  shifts JSONB NOT NULL DEFAULT '[]',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE schedule_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tpl_tenant ON schedule_templates;
CREATE POLICY tpl_tenant ON schedule_templates USING (tenant_id IN (SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid()));
