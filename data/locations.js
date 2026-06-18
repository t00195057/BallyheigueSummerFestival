/*
  Ballyheigue Summer Festival locations

  To add a new venue:
  1. Copy one location object.
  2. Give it a unique id, such as "new-hotel".
  3. Use that id in data/events.js as the event locationId.
*/
window.festivalLocations = [
  { id: "ballyheigue-beach", name: "Ballyheigue Beach", type: "Beach", lat: 52.38835, lng: -9.83545, description: "Main Ballyheigue beach festival area." },
  { id: "white-sands", name: "White Sands Hotel", type: "Pub", lat: 52.389053, lng: -9.833439, description: "Bar and festival venue near Ballyheigue Beach." },
  { id: "village-green", name: "Village Green", type: "Green", lat: 52.389226, lng: -9.835136, description: "Village green used for family and community events." },
  { id: "community-centre", name: "Ballyheigue Community Centre", type: "Community Centre", lat: 52.388343, lng: -9.833298, description: "Community centre venue for indoor events." },
  { id: "kirbys", name: "Kirby's Bar", type: "Pub", lat: 52.389184, lng: -9.832875, description: "Pub venue for music, bingo, karaoke and festival nightlife." },
  { id: "flahives", name: "Flahives Bar", type: "Pub", lat: 52.389437, lng: -9.831626, description: "Festival pub venue for music and social events." },
  { id: "reagans", name: "O'Regan's Bar", type: "Pub", lat: 52.389216, lng: -9.832493, description: "Festival pub venue." },
  { id: "castle-gates", name: "Castle Gates", type: "Landmark", lat: 52.389912, lng: -9.835467, description: "Meeting point at the castle gates." },
  { id: "ballyheigue-castle", name: "Ballyheigue Castle", type: "Landmark", lat: 52.392241, lng: -9.838904, description: "Historic Ballyheigue Castle area." },
  { id: "marian-park", name: "Marian Park", type: "Park", lat: 52.393428, lng: -9.844385, description: "Sports and community park area." },
  { id: "roger-casement-statue", name: "Roger Casement Statue", type: "Landmark", lat: 52.389124, lng: -9.834917, description: "Meeting point at the Roger Casement Statue." },
  { id: "dollys-green", name: "Dolly's Green", type: "Green", lat: 52.389255, lng: -9.835633, description: "Green area used for charity events." },
  { id: "village-centre", name: "Village Centre", type: "Village", lat: 52.3867, lng: -9.8279, description: "Central Ballyheigue village area." },
  { id: "old-graveyard", name: "Old Graveyard", type: "History", lat: 52.3924839146561,  lng: -9.830777849007035, description: "Old Graveyard event location. Coordinates can be adjusted later." },
  { id: "lower-beach-car-park", name: "Lower Beach Car Park", type: "Car Park", lat: 52.38816468692044, lng: -9.834637, description: "Lower beach car park beside Ballyheigue Beach." },
  { id: "lifeguard-hut", name: "Lifeguard Hut", type: "Beach", lat: 52.38777655431471, lng: -9.8345601, description: "Meeting point by the seasonal lifeguard station." },
  { id: "beach-sauna", name: "Beach Sauna", type: "Sauna", lat: 52.38818, lng: -9.83525, description: "Beach sauna location. Coordinates can be adjusted later." },
  { id: "golf-club", name: "Golf Club", type: "Sports", lat: 52.39268026423675, lng: -9.8391699, description: "Ballyheigue golf club." },
  { id: "dromatoor-pier", name: "Dromatoor Pier", type: "Pier", lat: 52.392146587313405, lng: -9.863809419085 ,description: "Pier meeting point for outdoor events. Coordinates to be confirmed." },
  { id: "kerryhead-frc", name: "Family Resource Centre", type: "Family Resource Centre", lat: 52.392122450333176, lng: -9.842406559288298 ,description: "Family Resource Centre venue. Coordinates to be confirmed." },
];
