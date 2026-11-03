export function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let quoted = false;
	const endRow = () => {
		row.push(field);
		field = '';
		if (row.some((f) => f !== '')) rows.push(row);
		row = [];
	};
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (quoted) {
			if (ch === '"' && text[i + 1] === '"') {
				field += '"';
				i++;
			} else if (ch === '"') quoted = false;
			else field += ch;
		} else if (ch === '"') quoted = true;
		else if (ch === ',') {
			row.push(field);
			field = '';
		} else if (ch === '\n') endRow();
		else if (ch !== '\r') field += ch;
	}
	endRow();
	return rows;
}

const quote = (f: string) => (/[",\r\n]/.test(f) ? `"${f.replaceAll('"', '""')}"` : f);

export function toCsv(rows: string[][]): string {
	return rows.map((r) => r.map(quote).join(',')).join('\n') + '\n';
}
