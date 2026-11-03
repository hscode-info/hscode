#!/usr/bin/env node
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createClient, type ClassifyResult, type ImportDuty, type Lang, type Mode } from './client.js';
import { parseCsv, toCsv } from './csv.js';
import { HscodeError } from './errors.js';

export interface CliIo {
	fetch?: typeof fetch;
	stdout?: { write(s: string): unknown };
	stderr?: { write(s: string): unknown };
	env?: Record<string, string | undefined>;
}

const ACCOUNT_URL = 'https://hscode.info/en/account';
const PRICING_URL = 'https://hscode.info/en/pricing';
const BATCH_SIZE = 25;

const COMMANDS: Record<string, string> = {
	classify: 'classify <text...> [--accurate] [--lang de|en|fr]\n  Suggest CN codes for a product description.',
	lookup: 'lookup <code> [--year 2026] [--lang de|en|fr]\n  Show description, hierarchy and import duties of a 10-digit code.',
	search: 'search <query...> [--year 2026] [--lang de|en|fr]\n  Search codes by words.',
	history: 'history <code> [--lang de|en|fr]\n  Show the third-country duty of a code in every yearly snapshot.',
	validate: 'validate <code>\n  Exit 0 if the code exists in the latest snapshot, 1 if not, 2 on other errors.',
	batch: 'batch <file.csv> [--column description] [--accurate] [--lang de|en|fr]\n  Classify one CSV column in chunks of 25. Writes CSV with hs_code,description,confidence added.'
};

const HELP = `hscode <command> [options]

Commands:
${Object.values(COMMANDS)
	.map((c) => '  ' + c.replace('\n  ', '\n      '))
	.join('\n')}

Options:
  --json         Print the raw JSON response.
  --key <key>    API key. Defaults to the HSCODE_KEY environment variable.
  -h, --help     Show help. Works per command too.
  --version      Show the version.

Get a key: ${ACCOUNT_URL}
Docs: https://hscode.info/api/v1/docs
`;

class UsageError extends Error {}

const formatCode = (c: string) =>
	c.length === 10 ? `${c.slice(0, 4)} ${c.slice(4, 6)} ${c.slice(6, 8)} ${c.slice(8)}` : c;

const isErgaOmnes = (d: ImportDuty) => d.origin_code === '1011' && d.meas_type_code === '103';
const thirdCountryDuty = (duties: ImportDuty[] | undefined) => duties?.find(isErgaOmnes)?.duty;

function table(rows: string[][]): string {
	const widths: number[] = [];
	for (const r of rows) r.forEach((c, i) => (widths[i] = Math.max(widths[i] ?? 0, c.length)));
	return (
		rows
			.map((r) => r.map((c, i) => (i === r.length - 1 ? c : c.padEnd(widths[i] ?? 0))).join('  '))
			.join('\n') + '\n'
	);
}

function classifyRows(results: ClassifyResult[]): string[][] {
	const showDuty = results.some((r) => thirdCountryDuty(r.duties));
	const showConf = results.some((r) => r.confidence != null);
	return results.map((r, i) => {
		const row = [`${i + 1}.`, formatCode(r.goods_code)];
		if (showDuty) row.push(thirdCountryDuty(r.duties) ?? '-');
		if (showConf) row.push(r.confidence != null ? r.confidence.toFixed(2) : '-');
		row.push(r.description);
		return row;
	});
}

export async function main(argv: string[], io: CliIo = {}): Promise<number> {
	const stdout = io.stdout ?? process.stdout;
	const stderr = io.stderr ?? process.stderr;
	const env = io.env ?? process.env;
	const out = (s: string) => void stdout.write(s);
	const err = (s: string) => void stderr.write(s);

	let parsed;
	try {
		parsed = parseArgs({
			args: argv,
			allowPositionals: true,
			options: {
				json: { type: 'boolean' },
				key: { type: 'string' },
				help: { type: 'boolean', short: 'h' },
				version: { type: 'boolean' },
				accurate: { type: 'boolean' },
				lang: { type: 'string' },
				year: { type: 'string' },
				column: { type: 'string' }
			}
		});
	} catch (e) {
		err(`${(e as Error).message}\nRun "hscode --help" for usage.\n`);
		return 2;
	}
	const { values, positionals } = parsed;
	const [command, ...rest] = positionals;

	if (values.version) {
		const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
		out(`${pkg.version}\n`);
		return 0;
	}
	if (!command || (values.help && !COMMANDS[command])) {
		out(HELP);
		return command || values.help ? 0 : 2;
	}
	if (!COMMANDS[command]) {
		err(`Unknown command "${command}". Run "hscode --help" for usage.\n`);
		return 2;
	}
	if (values.help) {
		out(`hscode ${COMMANDS[command]}\n`);
		return 0;
	}

	const apiKey = values.key ?? env.HSCODE_KEY;
	if (!apiKey) {
		err(
			`No API key found. Get one at ${ACCOUNT_URL}, then set HSCODE_KEY or pass --key.\n`
		);
		return 1;
	}
	const client = createClient({ apiKey, fetch: io.fetch });
	const lang = values.lang as Lang | undefined;
	const mode: Mode | undefined = values.accurate ? 'accurate' : undefined;
	const json = (data: unknown) => out(JSON.stringify(data, null, 2) + '\n');
	const arg = () => {
		const v = rest.join(' ');
		if (!v) throw new UsageError(`Missing argument. Usage: hscode ${COMMANDS[command]!.split('\n')[0]}`);
		return v;
	};

	try {
		switch (command) {
			case 'classify': {
				const res = await client.classify({ text: arg(), mode, lang });
				if (values.json) return json(res), 0;
				out(table(classifyRows(res.results)));
				if (res.disclaimer) out(`\n${res.disclaimer}\n`);
				return 0;
			}
			case 'lookup': {
				const res = await client.lookup({ code: arg(), lang, year: values.year });
				if (values.json) return json(res), 0;
				out(`${formatCode(res.goods_code)}  ${res.description}\n`);
				if (res.hierarchy.length) out(`\n${res.hierarchy.map((h) => h.description).join(' > ')}\n`);
				if (res.duties.length) {
					out('\n' + table(res.duties.map((d) => [d.origin, d.duty, d.measure_type, `${d.start_date}`])));
				}
				return 0;
			}
			case 'search': {
				const res = await client.search({ query: arg(), lang, year: values.year });
				if (values.json) return json(res), 0;
				out(table(res.items.map((h) => [formatCode(h.goods_code), h.description])));
				return 0;
			}
			case 'history': {
				const res = await client.history({ code: arg(), lang });
				if (values.json) return json(res), 0;
				out(
					table(
						(res.history ?? []).map((s) => [`${s.year}-${s.month}`, thirdCountryDuty(s.duties) ?? '-'])
					)
				);
				return 0;
			}
			case 'validate': {
				try {
					const res = await client.lookup({ code: arg(), year: values.year });
					if (values.json) return json(res), 0;
					out(`${formatCode(res.goods_code)}  ${res.description}\n`);
					return 0;
				} catch (e) {
					if (e instanceof HscodeError && (e.status === 404 || e.code === 'invalid_request')) {
						if (values.json) json({ valid: false, message: e.message });
						else err(`Invalid code: ${e.message}\n`);
						return 1;
					}
					if (e instanceof UsageError) throw e;
					err(`${e instanceof HscodeError && e.status === 429 ? limitMessage(e) : errorMessage(e)}\n`);
					return 2;
				}
			}
			case 'batch':
				return await batch(rest[0]);
		}
		return 2;
	} catch (e) {
		if (e instanceof UsageError) {
			err(`${e.message}\n`);
			return 2;
		}
		if (e instanceof HscodeError && e.status === 429) {
			err(`${limitMessage(e)}\n`);
			return 1;
		}
		err(`${errorMessage(e)}\n`);
		return 1;
	}

	async function batch(file: string | undefined): Promise<number> {
		if (!file) throw new UsageError(`Missing file. Usage: hscode ${COMMANDS.batch!.split('\n')[0]}`);
		const rows = parseCsv(readFileSync(file, 'utf8'));
		const header = rows.shift();
		if (!header) throw new UsageError(`${file} is empty.`);
		const col = values.column ? header.indexOf(values.column) : 0;
		if (col < 0) throw new UsageError(`Column "${values.column}" not found. Columns: ${header.join(', ')}`);

		const outRows = [[...header, 'hs_code', 'description', 'confidence']];
		for (let start = 0; start < rows.length; start += BATCH_SIZE) {
			const chunk = rows.slice(start, start + BATCH_SIZE);
			const items = chunk.flatMap((r, i) => {
				const text = (r[col] ?? '').trim().slice(0, 500);
				return text.length >= 2 ? [{ id: String(i), text }] : [];
			});
			const byId = new Map<string, ClassifyResult | undefined>();
			if (items.length) {
				const res = await client.classifyBatch({ items, mode, lang });
				for (const item of res.items) {
					if (item.error) err(`Row ${start + Number(item.id) + 2}: ${item.error}\n`);
					byId.set(item.id ?? '', item.results[0]);
				}
			}
			chunk.forEach((r, i) => {
				const top = byId.get(String(i));
				outRows.push([
					...r,
					top?.goods_code ?? '',
					top?.description ?? '',
					top?.confidence != null ? String(top.confidence) : ''
				]);
			});
			err(`Classified ${Math.min(start + BATCH_SIZE, rows.length)}/${rows.length}\n`);
		}
		out(toCsv(outRows));
		return 0;
	}
}

function limitMessage(e: HscodeError): string {
	return `${e.message}\nUpgrade: ${PRICING_URL}`;
}

function errorMessage(e: unknown): string {
	return e instanceof Error ? `Error: ${e.message}` : `Error: ${String(e)}`;
}

const entry = process.argv[1];
if (entry && realpathSync(entry) === fileURLToPath(import.meta.url)) {
	process.exitCode = await main(process.argv.slice(2));
}
