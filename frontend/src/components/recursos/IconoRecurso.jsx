import PropTypes from 'prop-types'
import {
  FaLaptopFile,
  FaRegFile,
  FaRegFileAudio,
  FaRegFileCode,
  FaRegFileExcel,
  FaRegFileImage,
  FaRegFileLines,
  FaRegFilePdf,
  FaRegFilePowerpoint,
  FaRegFileVideo,
  FaRegFileWord,
  FaRegFileZipper,
} from 'react-icons/fa6'

// mismos íconos que usa @cubone/react-file-manager, que no los exporta
const ICONOS_POR_EXTENSION = {
  pdf: FaRegFilePdf,
  jpg: FaRegFileImage,
  jpeg: FaRegFileImage,
  png: FaRegFileImage,
  txt: FaRegFileLines,
  doc: FaRegFileWord,
  docx: FaRegFileWord,
  mp4: FaRegFileVideo,
  webm: FaRegFileVideo,
  mp3: FaRegFileAudio,
  m4a: FaRegFileAudio,
  zip: FaRegFileZipper,
  ppt: FaRegFilePowerpoint,
  pptx: FaRegFilePowerpoint,
  xls: FaRegFileExcel,
  xlsx: FaRegFileExcel,
  exe: FaLaptopFile,
  ...Object.fromEntries(
    [
      ...['html', 'css', 'js', 'php', 'py', 'java', 'cpp', 'c', 'ts', 'jsx', 'tsx'],
      ...['json', 'xml', 'sql', 'csv', 'md', 'svg'],
    ].map((extension) => [extension, FaRegFileCode]),
  ),
}

/** Ícono del recurso según la extensión de su nombre; sin nombre se usa el genérico */
const IconoRecurso = ({ nombre, ...props }) => {
  const extension = nombre?.split('.').pop()?.toLowerCase()
  const Icono = ICONOS_POR_EXTENSION[extension] ?? FaRegFile
  return <Icono {...props} />
}

IconoRecurso.propTypes = {
  nombre: PropTypes.string,
}

export default IconoRecurso
