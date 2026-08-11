// Echelle commune a tout le rendu.
//
// 1 unite de scene = 1000 km. Ce choix garde les coordonnees du globe dans une
// plage confortable pour des flottants simple precision, mais il place un
// missile de 15 m a 1.5e-5 unite : d'ou le tampon de profondeur logarithmique,
// sans lequel une scene contenant a la fois l'engin et la planete serait
// criblee d'artefacts.
export const SCENE_SCALE = 1e-6;
