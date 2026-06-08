// Loader inicial estilo HUD: anel girando + marca NOVA.
export default function Loader() {
  return (
    <div className="loader">
      <div className="loader-core">
        <span className="loader-ring" />
        <span className="loader-logo">N</span>
      </div>
      <div className="loader-text">carregando</div>
    </div>
  )
}
