
import { CardTransaction } from "@/store/transactionStore";

interface Props {
  data: CardTransaction[];
}

const CardsTable = ({ data }: Props) => {
  if (!data?.length) return null;

  return (
    <div className="my-4 overflow-x-auto">
      <h3 className="font-semibold mb-2">Transazioni Carte</h3>
      <table className="min-w-full text-sm border rounded">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 text-left">Data</th>
            <th className="p-2 text-left">BIN</th>
            <th className="p-2 text-left">Nome</th>
            <th className="p-2 text-right">Importo</th>
          </tr>
        </thead>
        <tbody>
          {data.map((t, idx) => (
            <tr key={idx} className="border-t">
              <td className="p-2">{t.date}</td>
              <td className="p-2">{t.bin}</td>
              <td className="p-2">{t.name}</td>
              <td className="p-2 text-right">{t.amount.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CardsTable;
