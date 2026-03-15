-- calls table for tracking Twilio calls
CREATE TABLE IF NOT EXISTS public.calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  call_sid text UNIQUE,
  from_number text,
  to_number text,
  status text DEFAULT 'queued',
  direction text DEFAULT 'inbound',
  duration integer DEFAULT 0,
  recording_url text,
  transcript text,
  summary text,
  reservation_created boolean DEFAULT false,
  order_created boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants see own calls" ON public.calls
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  );