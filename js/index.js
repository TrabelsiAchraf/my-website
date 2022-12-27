
// Get full year date for copyright text
var datetime = new Date().getFullYear();
document.getElementById("year").textContent = datetime;

// Switch frames
function showResumeFrame() {
    document.getElementById('container').innerHTML = '<iframe src="files/CV_Achraf_Trabelsi.pdf" frameborder="0" width="100%" height="800"></iframe>';
}