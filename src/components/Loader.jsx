import PinwheelIcon from './PinwheelIcon'

// Loader inicial estilo HUD: anel girando + símbolo Nova notes.
export default function Loader() {
  return (
    <div className="loader">
      <div className="loader-core">
        <span className="loader-ring" />
        <PinwheelIcon className="loader-logo" size={34} />
      </div>
      <div className="loader-text">carregando</div>
    </div>
  )
}
