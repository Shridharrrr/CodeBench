package migrations

import _ "embed"

//go:embed 000001_init_schema.up.sql
var InitSchemaSQL string

//go:embed 000001_init_schema.down.sql
var DownSchemaSQL string

//go:embed 000002_ctfd_evolution.up.sql
var EvolutionSchemaSQL string
