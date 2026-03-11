export default function GraphInputs() {

  return (
    <div className="w-1/4 border-r p-4">

      <h2 className="font-semibold mb-4">
        Graph Data
      </h2>

      <div className="flex gap-2 mb-2">
        <input placeholder="From" className="border p-1 w-full"/>
        <input placeholder="To" className="border p-1 w-full"/>
        <input placeholder="Weight" className="border p-1 w-full"/>
      </div>

      <button className="bg-blue-500 text-white px-3 py-1 rounded">
        Add
      </button>

    </div>
  )
}