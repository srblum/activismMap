var ageIndex = 0, 
	interestIndex = 0, 
	selectedCountry = "Canada", 
	selectedVariable = "satisfaction";

var format = d3.format(",");

// Set tooltips
var tip = d3.tip()
		.attr('class', 'd3-tip')
		.offset([-10, 0])
		.html(function(d) {
			return "<strong>Country: </strong><span class='details'>" + d.properties.NAME_SORT + "<br></span>" + "<strong>Population: </strong><span class='details'>" + format(d.population) +"</span>";
		})

var margin = {top: 0, right: 0, bottom: 0, left: 0},
		width = 1200 - margin.left - margin.right,
		height = 600 - margin.top - margin.bottom;

var path = d3.geoPath();

var svg = d3.select("svg")
		.attr("width", width)
		.attr("height", height)
		.style('margin-top',75)
		.append('g')
		.attr('class', 'map');

var projection = d3.geoNaturalEarth1()
				.scale(250)
				.translate( [width / 2.2, height / 1.75]);

var path = d3.geoPath().projection(projection);

svg.call(tip);

queue()
.defer(d3.json, "world_countries.json")
.defer(d3.tsv, "world_population.tsv")
.defer(d3.tsv, "survey_data2.txt") //exported as tsv from excel and 
									//converted to utf8 using  iconv -f LATIN1 -t UTF8 survey_data.txt >> survey_data2.txt
.await(ready);

//For the most part, country names in the data correspond to the NAME_LONG attribute of the GeoJSON file
//The exceptions are stored in the object below
var countryNameTranslations = {
	"United States":"United States of America",
	"Swaziland":"eSwatini"
} 

function ready(error, world, population, data) {
	var populationById = {};
	var dataByCountry = {};

	population.forEach(function(d) { populationById[d.id] = +d.population; });
	world.features.forEach(function(d) { d.population = populationById[d.properties.ADM0_A3] });

	//Translation functions from age and interest sectors in original data to the matrix indices in dataByCountry
	function getAgeIndex(age){
		if(age==='Uner 29'){
			return 0
		}else if(age==='29-38'){
			return 1
		}else if(age==='39+'){
			return 2
		}
	}
	function getInterestIndex(interest){
		if(interest==='1'){
			return 0
		}else if(interest==='5'){
			return 1
		}else if(interest==='9'){
			return 2
		}
	}

	data.forEach(function(d){
		//Fix a few country names to ensure they correspond with names in GeoJSON
		var country = d.Country;
		if(countryNameTranslations.hasOwnProperty(country)){
			country = countryNameTranslations[country];
		}
		//Initialize with 3x3 matrix (age x interest)
		if(!dataByCountry.hasOwnProperty(country)){
			dataByCountry[country] =	[[{},{},{}],
										[{},{},{}],
										[{},{},{}]];
		}
		//Fill appropriate cell with named data
		var cell = dataByCountry[country][getAgeIndex(d["Age Group"])][getInterestIndex(d["Interest in Politics"])];
		cell["satisfaction"] = +d["Satisfied with Government"];
		cell["voice"] = +d["Feel like have a voice"];
		cell["democracy"] = +d["Democracy Preferred"];
		cell["other"] = +d["Otner Preferred"];
		cell["protest"] = +d["Like to Protest"];
		cell["party"] = +d["Like work with political parties"];
		cell["boycott"] = +d["Like to boycott"];
		cell["campaign"] = +d["Like to campaign for politician"];
	});


	var color = d3.scaleThreshold()
	    .domain(d3.range(2, 10))
	    .range(d3.schemeBlues[9]);

	var countries = svg.append("g")
		.attr("class", "countries")
	.selectAll("path")
		.data(world.features)
	.enter().append("path")
		.attr("d", path)
		.style("fill", getCountryColor)
		.style('stroke', 'black')
		.style('stroke-width', 1)
		.style("opacity",0.8)
		.style('stroke-width', 0.1)
		.on('mouseover',function(d){
			tip.show(d);
		})
		.on('mouseout', function(d){
			tip.hide(d);
		})
		.on('click',function(d){
			selectedCountry = d.properties.NAME_SORT;
			$("#d3-container path").removeClass("selected");
			$(this).addClass("selected");
			updateColumns();
			updateInfo();
		})

	$(".button-div button[name='0']").addClass("selected")

	//When an age or interest button is clicked, update the column charts and map colors
	$("#interest-div button").on("click",function(){
		$("#interest-div button").removeClass("selected");
		$(this).addClass("selected")
		interestIndex = +$(this).attr("name");
		updateColumns();
		updateInfo();
		countries.transition().duration(500).style("fill",getCountryColor);
	})
	$("#age-div button").on("click",function(){
		$("#age-div button").removeClass("selected");
		$(this).addClass("selected");
		ageIndex = +$(this).attr("name");
		updateColumns();
		updateInfo();
		countries.transition().duration(500).style("fill",getCountryColor);
	})

	//When a new variable is selected, update the map colors
	$("#variable-select").on("change",function(){
		selectedVariable = $(this).val();
		countries.transition().duration(500).style("fill",getCountryColor);
	})

	function getCountryColor(d){		
		var country = d.properties.NAME_SORT;
		if(dataByCountry.hasOwnProperty(country)){
			var value = dataByCountry[country][ageIndex][interestIndex][selectedVariable];
			return color(value);
		}else{
			return 'black';
		}
	}

	//Update columns based on data from selected country, age, and interest
	function updateColumns(){
		//TODO: inform user when country not present in data (and indicate visually on map?)
		var cell = dataByCountry[selectedCountry][ageIndex][interestIndex];
		//Update all columns
		updateColumn(d3.select("#satisfaction-column"),cell["satisfaction"]);
		updateColumn(d3.select("#voice-column"),cell["voice"]);
		updateColumn(d3.select("#demo-column"),cell["democracy"]);
		updateColumn(d3.select("#other-column"),cell["other"]);
		updateColumn(d3.select("#protest-column"),cell["protest"]);
		updateColumn(d3.select("#boycott-column"),cell["boycott"]);
		updateColumn(d3.select("#party-column"),cell["party"]);
		updateColumn(d3.select("#campaign-column"),cell["campaign"]);
		//Update the chart title
	}

	var scaleY = d3.scaleLinear().domain([1,10]).range([8,80]);

	// animate a column to the appropriate value
	function updateColumn(column, value){
		column.transition()
				.duration(500)
				.style("height",scaleY(value)+"px")
				.style("background-color",color(value));
	}

	function updateInfo(){
		$("#column-info").html(`${selectedCountry} <span>(ages \
			${ageIndex==0 ? "<29" : ageIndex==1 ? "29-38" : ">38"}, \
			${interestIndex==0 ? "low" : interestIndex==1 ? "medium" : "high"} political interest)</span>`);
	}

	updateColumns();
	updateInfo();
}