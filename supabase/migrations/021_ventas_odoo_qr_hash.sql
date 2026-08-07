-- Space to receive the Veri*Factu QR/hash once odoo-sync actually calls
-- action_post() and the Spanish localization module is confirmed active
-- (see project notes — not wired yet, this is just where it'll land).
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS odoo_qr_url TEXT;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS odoo_verifactu_hash TEXT;
