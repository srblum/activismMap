var ageIndex, 
	interestIndex,
	selectedCountry = "Canada", 
	selectedVariable = "satisfaction";

var format = d3.format(",");

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

var dataByCountry = {};

function ready(error, world, population, data) {
	var populationById = {};
	

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
	    .domain(d3.range(1, 10))
	    .range(["#f9fbff","#f1f3ff"].concat(d3.schemeBlues[9].slice(1)));

	//Create countries on map
	var countries = svg.append("g")
		.attr("class", "countries")
	.selectAll("path")
		.data(world.features)
	.enter().append("path")
		.attr("d", path)
		.style("fill", getCountryColor)
		.classed("selected",d => d.properties.NAME_SORT==="Canada" ? true : false)
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
		.on('click',function(d){  //Update columns when country is clicked
			if(dataByCountry.hasOwnProperty(d.properties.NAME_SORT)){
				selectedCountry = d.properties.NAME_SORT;
				$("#d3-container path").removeClass("selected");
				$(this).addClass("selected");
				updateColumns();
				updateInfo();
			}
		})

	d3.select("#color-legend").selectAll("div")
	  .data(color.range().reverse())
	  .enter().append("div")
	    .style("background-color", d => d);


	//When an age or interest button is clicked, update the column charts and map colors
	$("#interest-div button").on("click",function(){
		if($(this).hasClass('selected')){
			$("#interest-div button").removeClass("selected");
			interestIndex = undefined;
		}else{
			$("#interest-div button").removeClass("selected");
			$(this).addClass("selected");
			interestIndex = +$(this).attr("name");
		}
		updateColumns();
		updateInfo();
		countries.transition().duration(500).style("fill",getCountryColor);
	})
	$("#age-div button").on("click",function(){
		if($(this).hasClass('selected')){
			$("#age-div button").removeClass("selected");
			ageIndex = undefined;
		}else{
			$("#age-div button").removeClass("selected");
			$(this).addClass("selected");
			ageIndex = +$(this).attr("name");
		}
		updateColumns();
		updateInfo();
		countries.transition().duration(500).style("fill",getCountryColor);
	})

	//When a new variable is selected, update the map colors
	$(".column-container").on("click",function(){
		selectedVariable = $(this).attr('name');
		$(".column-container").removeClass("selected");
		$(this).addClass("selected");
		updateColumns();
		countries.transition().duration(500).style("fill",getCountryColor);
	})

	function getCountryColor(d){		
		var country = d.properties.NAME_SORT;
		if(dataByCountry.hasOwnProperty(country)){
			var cell = getCell(country);
			var value = cell[selectedVariable];
			return color(value);
		}else{
			return 'white';
		}
	}

	//Update columns based on data from selected country, age, and interest
	function updateColumns(){
		var cell = getCell();
		//Update all columns
		updateColumn(d3.select("#satisfaction-container"),cell["satisfaction"]);
		updateColumn(d3.select("#voice-container"),cell["voice"]);
		updateColumn(d3.select("#demo-container"),cell["democracy"]);
		updateColumn(d3.select("#other-container"),cell["other"]);
		updateColumn(d3.select("#protest-container"),cell["protest"]);
		updateColumn(d3.select("#boycott-container"),cell["boycott"]);
		updateColumn(d3.select("#party-container"),cell["party"]);
		updateColumn(d3.select("#campaign-container"),cell["campaign"]);
	}

	var scaleY = d3.scaleLinear().domain([1,10]).range([15,150]);

	// animate a column to the appropriate value
	function updateColumn(container, value){
		container.select(".column-div").transition()
				.duration(500)
				.style("height",scaleY(value)+"px")
				.style("background-color",container.classed('selected') ? "orange" : color(value));
	}

	function updateInfo(){
		$("#column-info").html(`${selectedCountry} <span>${ageIndex!==undefined || interestIndex!==undefined ? "(" : ""}${ageIndex!==undefined ? "age ":""} \
			${ageIndex==0 ? "<29" : ageIndex==1 ? "29-38" : ageIndex==2 ? ">38" : ""}${interestIndex!==undefined && ageIndex!==undefined ? ", " : ""}\
			${interestIndex==0 ? "low" : interestIndex==1 ? "medium" : interestIndex==2 ? "high" : ""}${interestIndex!==undefined ? " political interest":""}\
			${ageIndex!==undefined || interestIndex!==undefined ? ")" : ""}</span>`);
	}

	function getCell(country){
		var cells,
			empty = {
				"satisfaction":0,
				"voice":0,
				"democracy":0,
				"other":0,
				"protest":0,
				"party":0,
				"campaign":0,
				"boycott":0
			};
		if(country===undefined){
			var country = selectedCountry;
		}

		//If no age/interest is selected, then create a new cell by averaging together values from the appropriate cells
		if(ageIndex===undefined && interestIndex===undefined){
			cells = dataByCountry[country].reduce(function(a,b){return a.concat(b)},[]);
		}else if(ageIndex===undefined){
			cells = dataByCountry[country].reduce(function(a,b){return a.concat(b[interestIndex])},[]);
		}else if(interestIndex===undefined){
			cells = dataByCountry[country][ageIndex];
		}else{
			cells = [dataByCountry[country][ageIndex][interestIndex]];
		}
		var cell = cells.reduce(function(a,b){
			var sum = {};
			for(prop in a){
				if(a.hasOwnProperty(prop)){
					sum[prop] = a[prop] + b[prop];
				}
			}
			return sum;
		},empty);
		for(prop in cell){
			if(cell.hasOwnProperty(prop)){
				cell[prop] /= cells.length;
			}
		}
		return cell;
	}

	// Set tooltips
	var tip = d3.tip()
			.attr('class', 'd3-tip')
			.offset([-10, 0])
			.html(function(d) {
				var f = d3.format(".1f");
				var country = d.properties.NAME_SORT;
				var value = getCell(country)[selectedVariable]
				return "<strong>Country: </strong><span class='details'>" + country + "<br></span>"
				 + "<strong>"+selectedVariable[0].toUpperCase()+selectedVariable.slice(1)+
				 ": </strong><span class='details'>" + (dataByCountry.hasOwnProperty(country) 
				 	? (value % 1 === 0 ? value : f(value)) : 
				 	"not surveyed") +"</span>";
			})

	updateColumns();
	updateInfo();
	svg.call(tip);
}