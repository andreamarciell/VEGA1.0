
import { useCallback } from "react";
import * as XLSX from "xlsx";
import { Movement, CardTransaction, TransactionResults } from "@/store/transactionStore";

function readSheet(file: File): Promise<any[][]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (e) => reject(e);
    reader.readAsArrayBuffer(file);
  });
}

function rowsToMovements(rows: any[][]): Movement[] {
  if (!rows.length) return [];
  // naive heuristic: first row is header
  const header = rows[0].map((c: any) => String(c).toLowerCase());
  const cDate = header.findIndex((h: string) => /data|date/.test(h));
  const cDesc = header.findIndex((h: string) => /descr/i.test(h));
  const cAmt = header.findIndex((h: string) => /importo|amount|ammontare|valore/.test(h));

  return rows.slice(1).map((r) => ({
    date: r[cDate] ? String(r[cDate]) : "",
    description: r[cDesc] ? String(r[cDesc]) : "",
    amount: Number(r[cAmt] ?? 0),
  }));
}

export const useParseTransactions = () => {
  const parseMovements = useCallback(async (file?: File) : Promise<Movement[]> => {
    if (!file) return [];
    const rows = await readSheet(file);
    return rowsToMovements(rows);
  }, []);

  const parseCards = useCallback(async (file?: File): Promise<CardTransaction[]> => {
    if (!file) return [];
    const rows = await readSheet(file);
    const header = rows[0].map((c: any) => String(c).toLowerCase());
    const cDate = header.findIndex((h: string) => /data|date/.test(h));
    const cBin = header.findIndex((h: string) => /bin/.test(h));
    const cName = header.findIndex((h: string) => /nome|name/.test(h));
    const cAmt = header.findIndex((h: string) => /importo|amount|ammontare|valore/.test(h));
    return rows.slice(1).map((r) => ({
      date: r[cDate] ? String(r[cDate]) : "",
      bin: r[cBin] ? String(r[cBin]) : "",
      name: r[cName] ? String(r[cName]) : "",
      amount: Number(r[cAmt] ?? 0),
    }));
  }, []);

  const parseAll = useCallback(async (files: {deposits?: File|null, withdrawals?: File|null, cards?: File|null}): Promise<TransactionResults> => {
    const [deposits, withdrawals, cards] = await Promise.all([
      parseMovements(files.deposits ?? undefined),
      parseMovements(files.withdrawals ?? undefined),
      parseCards(files.cards ?? undefined),
    ]);
    return { deposits, withdrawals, cards };
  }, [parseMovements, parseCards]);

  return {
    parseMovements,
    parseCards,
    parseAll,
  };
};
