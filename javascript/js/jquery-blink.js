(function($)
{
	$.fn.blink = function(options)
	{
		var defaults = { delay:500 };
		var options = $.extend(defaults, options);
		
		return this.each(function()
		{
			var obj = $(this);
			setInterval(function()
			{
				if($(obj).css("color") == 'rgb(255, 0, 0)')
				{
					//alert('if is red set black loop' + $(obj).css("color"));
					$(obj).css('color','black');
				}
				else
				{
					//alert('if not red set red loop' + $(obj).css("color"));
					$(obj).css('color','red');
				}
			}, options.delay);
		});
	}
}(jQuery))