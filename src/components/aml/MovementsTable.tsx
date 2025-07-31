
import { Movement } from "@/store/transactionStore";

interface Props {
  title: string;
  data: Movement[];
}

const MovementsTable = ({ title, data }: Props) => {
  if (!data?.length) return null;

  return (
    <div className="my-4 overflow-x-auto">
      <h3 className="font-semibold mb-2">{title}</h3>
      <table className="min-w-full text-sm border rounded">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 text-left">Data</th>
            <th className="p-2 text-left">Descrizione</th>
            <th className="p-2 text-right">Importo</th>
          </tr>
        </thead>
        <tbody>
          {data.map((m, idx) => (
            <tr key={idx} className="border-t">
              <td className="p-2">{m.date}</td>
              <td className="p-2">{m.description}</td>
              <td className="p-2 text-right">{m.amount.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default MovementsTable;
