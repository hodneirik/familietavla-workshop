-- Egne faste regler for middag, adskilt fra reglene for ukeplanen (som handler om skole, gym og turdager).
ALTER TABLE ki_regler ADD COLUMN middag_regler TEXT NOT NULL DEFAULT '' CHECK (length(middag_regler) <= 1000);
